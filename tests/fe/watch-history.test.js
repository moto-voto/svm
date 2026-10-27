import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildHistoryRecord,
    sortHistoryByRecent,
    filterHistoryByQuery,
    toHistoryTile,
    buildHistoryTiles,
    padBadgeNumber,
    loadWatchHistory,
    saveWatchHistory,
    HISTORY_STORE_NAME,
    DB_VERSION,
} from '../../src/ui/watch-progress.js';

test('buildHistoryRecord creates a fresh record from an update', () => {
    const record = buildHistoryRecord(null, {
        seriesId: '123',
        title: 'Breaking Bad',
        image: 'https://x/poster.jpg',
        fullLink: 'https://seasonvar.ru/serial-1.html',
        lastSeasonLink: 'https://seasonvar.ru/serial-1/1-season.html',
        seasonNumber: 1,
        episodeNumber: 5,
    });
    assert.equal(record.key, '123');
    assert.equal(record.seriesId, '123');
    assert.equal(record.title, 'Breaking Bad');
    assert.equal(record.image, 'https://x/poster.jpg');
    assert.equal(record.fullLink, 'https://seasonvar.ru/serial-1.html');
    assert.equal(record.lastSeasonLink, 'https://seasonvar.ru/serial-1/1-season.html');
    assert.equal(record.seasonNumber, 1);
    assert.equal(record.episodeNumber, 5);
    assert.equal(typeof record.updatedAt, 'number');
});

test('buildHistoryRecord keeps old metadata when the update omits it (deep-link player)', () => {
    const existing = {
        key: '123',
        seriesId: '123',
        title: 'Breaking Bad',
        image: 'https://x/old.jpg',
        fullLink: 'https://seasonvar.ru/serial-1.html',
        lastSeasonLink: 's1',
        seasonNumber: 1,
        episodeNumber: 5,
        updatedAt: 1,
    };
    const record = buildHistoryRecord(existing, {
        seriesId: '123',
        // No title/image/fullLink: the player was opened without metadata.
        lastSeasonLink: 's2',
        seasonNumber: 2,
        episodeNumber: 1,
    });
    assert.equal(record.title, 'Breaking Bad');
    assert.equal(record.image, 'https://x/old.jpg');
    assert.equal(record.fullLink, 'https://seasonvar.ru/serial-1.html');
    assert.equal(record.lastSeasonLink, 's2');
    assert.equal(record.seasonNumber, 2);
    assert.equal(record.episodeNumber, 1);
    assert.ok(record.updatedAt > existing.updatedAt);
    // The existing record is untouched.
    assert.equal(existing.seasonNumber, 1);
    assert.equal(existing.lastSeasonLink, 's1');
});

test('buildHistoryRecord overwrites metadata when the update provides it', () => {
    const existing = {
        key: '123',
        seriesId: '123',
        title: 'Old Title',
        image: null,
        fullLink: '',
        lastSeasonLink: '',
        seasonNumber: null,
        episodeNumber: null,
        updatedAt: 1,
    };
    const record = buildHistoryRecord(existing, {
        seriesId: '123',
        title: 'New Title',
        image: 'https://x/new.jpg',
        lastSeasonLink: 's4',
        seasonNumber: 4,
        episodeNumber: 2,
    });
    assert.equal(record.title, 'New Title');
    assert.equal(record.image, 'https://x/new.jpg');
    assert.equal(record.seasonNumber, 4);
    assert.equal(record.episodeNumber, 2);
});

test('sortHistoryByRecent puts the most recently watched series first', () => {
    const records = [
        { seriesId: 'a', updatedAt: 100 },
        { seriesId: 'b', updatedAt: 300 },
        { seriesId: 'c', updatedAt: 200 },
    ];
    assert.deepEqual(
        sortHistoryByRecent(records).map((r) => r.seriesId),
        ['b', 'c', 'a']
    );
    // The input array is not mutated.
    assert.deepEqual(
        records.map((r) => r.seriesId),
        ['a', 'b', 'c']
    );
});

test('sortHistoryByRecent tolerates missing timestamps and undefined input', () => {
    assert.deepEqual(
        sortHistoryByRecent([{ seriesId: 'a' }, { seriesId: 'b', updatedAt: 1 }]).map((r) => r.seriesId),
        ['b', 'a']
    );
    assert.deepEqual(sortHistoryByRecent(null), []);
    assert.deepEqual(sortHistoryByRecent(undefined), []);
});

test('filterHistoryByQuery matches titles case-insensitively', () => {
    const records = [{ title: 'Game of Thrones' }, { title: 'Breaking Bad' }];
    assert.equal(filterHistoryByQuery(records, 'breaking').length, 1);
    assert.equal(filterHistoryByQuery(records, 'BREAKING').length, 1);
    assert.equal(filterHistoryByQuery(records, 'game of').length, 1);
    assert.equal(filterHistoryByQuery(records, 'xyz').length, 0);
});

test('filterHistoryByQuery returns everything for an empty query', () => {
    const records = [{ title: 'A' }, { title: 'B' }];
    assert.equal(filterHistoryByQuery(records, ''), records);
    assert.equal(filterHistoryByQuery(records, '   '), records);
    assert.equal(filterHistoryByQuery(records, null), records);
    assert.equal(filterHistoryByQuery(records, undefined), records);
});

test('toHistoryTile maps a record to the grid tile shape', () => {
    const tile = toHistoryTile({
        seriesId: '9',
        title: 'A',
        image: 'img',
        fullLink: 'link',
        seasonNumber: 2,
        episodeNumber: 7,
    });
    assert.deepEqual(tile, {
        id: '9',
        title: 'A',
        image: 'img',
        fullLink: 'link',
        seasonNumber: 2,
        episodeNumber: 7,
    });
});

test('buildHistoryTiles filters, drops unlinkable records and maps to tiles', () => {
    const records = [
        { seriesId: '1', title: 'Alpha', fullLink: 'https://a/alpha.html', seasonNumber: 1, episodeNumber: 2 },
        { seriesId: '2', title: 'Beta', fullLink: '', seasonNumber: 1, episodeNumber: 2 },
        { seriesId: '3', title: 'alphabet', fullLink: 'https://a/alphabet.html', seasonNumber: 4, episodeNumber: 1 },
    ];
    const tiles = buildHistoryTiles(records, 'alpha');
    assert.deepEqual(tiles.map((t) => t.id), ['1', '3']);
    assert.deepEqual(tiles[0], {
        id: '1',
        title: 'Alpha',
        image: null,
        fullLink: 'https://a/alpha.html',
        seasonNumber: 1,
        episodeNumber: 2,
    });
});

test('padBadgeNumber zero-pads 1-based numbers for S/E badges', () => {
    assert.equal(padBadgeNumber(1), '01');
    assert.equal(padBadgeNumber(5), '05');
    assert.equal(padBadgeNumber(12), '12');
    assert.equal(padBadgeNumber(0), null);
    assert.equal(padBadgeNumber(-1), null);
    assert.equal(padBadgeNumber(1.5), null);
    assert.equal(padBadgeNumber(null), null);
    assert.equal(padBadgeNumber(undefined), null);
});

test('history IndexedDB helpers degrade gracefully without a browser', async () => {
    assert.deepEqual(await loadWatchHistory(), []);
    assert.equal(await saveWatchHistory('123', { title: 'A' }), false);
    assert.equal(HISTORY_STORE_NAME, 'watchHistory');
    assert.equal(DB_VERSION, 4);
});
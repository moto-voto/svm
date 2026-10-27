import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildBookmark,
    sortBookmarksByAdded,
    filterBookmarksByQuery,
    toBookmarkTile,
    buildBookmarkTiles,
    loadBookmarks,
    isBookmarked,
    saveBookmark,
    removeBookmark,
    BOOKMARKS_STORE_NAME,
    BOOKMARKS_DB_NAME,
    BOOKMARKS_DB_VERSION,
} from '../../src/ui/bookmarks.js';

test('buildBookmark creates a fresh record from an update', () => {
    const record = buildBookmark(null, {
        seriesId: '123',
        title: 'Breaking Bad',
        image: 'https://x/poster.jpg',
        fullLink: 'https://seasonvar.ru/serial-1.html',
    });
    assert.equal(record.key, '123');
    assert.equal(record.seriesId, '123');
    assert.equal(record.title, 'Breaking Bad');
    assert.equal(record.image, 'https://x/poster.jpg');
    assert.equal(record.fullLink, 'https://seasonvar.ru/serial-1.html');
    assert.equal(typeof record.addedAt, 'number');
});

test('buildBookmark keeps the original addedAt on re-save (no reordering)', () => {
    const existing = {
        key: '123',
        seriesId: '123',
        title: 'Old',
        image: null,
        fullLink: 'https://seasonvar.ru/serial-1.html',
        addedAt: 100,
    };
    const record = buildBookmark(existing, {
        seriesId: '123',
        title: 'New Title',
        image: 'https://x/new.jpg',
    });
    assert.equal(record.title, 'New Title');
    assert.equal(record.image, 'https://x/new.jpg');
    assert.equal(record.addedAt, 100);
    // The existing record is untouched.
    assert.equal(existing.title, 'Old');
    assert.equal(existing.image, null);
});

test('buildBookmark keeps old metadata when the update omits it', () => {
    const existing = {
        key: '123',
        seriesId: '123',
        title: 'Breaking Bad',
        image: 'https://x/poster.jpg',
        fullLink: 'https://seasonvar.ru/serial-1.html',
        addedAt: 1,
    };
    const record = buildBookmark(existing, { seriesId: '123' });
    assert.equal(record.title, 'Breaking Bad');
    assert.equal(record.image, 'https://x/poster.jpg');
    assert.equal(record.fullLink, 'https://seasonvar.ru/serial-1.html');
});

test('sortBookmarksByAdded puts the most recently bookmarked first', () => {
    const records = [
        { seriesId: 'a', addedAt: 100 },
        { seriesId: 'b', addedAt: 300 },
        { seriesId: 'c', addedAt: 200 },
    ];
    assert.deepEqual(
        sortBookmarksByAdded(records).map((r) => r.seriesId),
        ['b', 'c', 'a']
    );
    // The input array is not mutated.
    assert.deepEqual(
        records.map((r) => r.seriesId),
        ['a', 'b', 'c']
    );
});

test('sortBookmarksByAdded tolerates missing timestamps and undefined input', () => {
    assert.deepEqual(
        sortBookmarksByAdded([{ seriesId: 'a' }, { seriesId: 'b', addedAt: 1 }]).map((r) => r.seriesId),
        ['b', 'a']
    );
    assert.deepEqual(sortBookmarksByAdded(null), []);
    assert.deepEqual(sortBookmarksByAdded(undefined), []);
});

test('filterBookmarksByQuery matches titles case-insensitively', () => {
    const records = [{ title: 'Game of Thrones' }, { title: 'Breaking Bad' }];
    assert.equal(filterBookmarksByQuery(records, 'breaking').length, 1);
    assert.equal(filterBookmarksByQuery(records, 'BREAKING').length, 1);
    assert.equal(filterBookmarksByQuery(records, 'game of').length, 1);
    assert.equal(filterBookmarksByQuery(records, 'xyz').length, 0);
});

test('filterBookmarksByQuery returns everything for an empty query', () => {
    const records = [{ title: 'A' }, { title: 'B' }];
    assert.equal(filterBookmarksByQuery(records, ''), records);
    assert.equal(filterBookmarksByQuery(records, '   '), records);
    assert.equal(filterBookmarksByQuery(records, null), records);
    assert.equal(filterBookmarksByQuery(records, undefined), records);
});

test('toBookmarkTile maps a record to the grid tile shape', () => {
    const tile = toBookmarkTile({
        seriesId: '9',
        title: 'A',
        image: 'img',
        fullLink: 'link',
        addedAt: 1,
    });
    assert.deepEqual(tile, { id: '9', title: 'A', image: 'img', fullLink: 'link' });
});

test('buildBookmarkTiles filters, drops unlinkable records and maps to tiles', () => {
    const records = [
        { seriesId: '1', title: 'Alpha', fullLink: 'https://a/alpha.html', addedAt: 3 },
        { seriesId: '2', title: 'Beta', fullLink: '', addedAt: 2 },
        { seriesId: '3', title: 'alphabet', fullLink: 'https://a/alphabet.html', addedAt: 1 },
    ];
    const tiles = buildBookmarkTiles(records, 'alpha');
    assert.deepEqual(tiles.map((t) => t.id), ['1', '3']);
    assert.deepEqual(tiles[0], { id: '1', title: 'Alpha', image: null, fullLink: 'https://a/alpha.html' });
});

test('bookmark IndexedDB helpers degrade gracefully without a browser', async () => {
    assert.deepEqual(await loadBookmarks(), []);
    assert.equal(await isBookmarked('123'), false);
    assert.equal(await saveBookmark('123', { title: 'A' }), false);
    assert.equal(await removeBookmark('123'), false);
    assert.equal(BOOKMARKS_STORE_NAME, 'bookmarks');
    assert.equal(BOOKMARKS_DB_NAME, 'svm-bookmarks');
    assert.equal(BOOKMARKS_DB_VERSION, 1);
});
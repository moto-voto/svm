import test from 'node:test';
import assert from 'node:assert/strict';

import {
    watchProgressKey,
    resolveResumeState,
    upsertEpisodeProgress,
    upsertSeriesProgress,
    resolveResumeSeasonLink,
    loadSeasonProgress,
    saveEpisodeProgress,
    loadSeriesProgress,
    saveSeriesProgress,
    PROGRESS_SAVE_INTERVAL_MS,
} from '../../src/ui/watch-progress.js';

test('watchProgressKey encodes both series and season', () => {
    assert.equal(watchProgressKey('https://a/series', 'https://a/s1'), 'https://a/series::https://a/s1');
    assert.equal(watchProgressKey(undefined, undefined), '::');
});

test('resolveResumeState falls back to the first episode without a record', () => {
    assert.deepEqual(resolveResumeState(null, 10), { episodeIndex: 0, position: 0 });
    assert.deepEqual(resolveResumeState(undefined, 10), { episodeIndex: 0, position: 0 });
    assert.deepEqual(resolveResumeState({ lastEpisodeIndex: 3, episodes: { 3: 42 } }, 0), {
        episodeIndex: 0,
        position: 0,
    });
});

test('resolveResumeState returns the last played episode and its position', () => {
    const record = { lastEpisodeIndex: 2, episodes: { 0: 10, 2: 120.5 } };
    assert.deepEqual(resolveResumeState(record, 5), { episodeIndex: 2, position: 120.5 });
});

test('resolveResumeState guards against out-of-range episode indices', () => {
    const record = { lastEpisodeIndex: 9, episodes: { 9: 120 } };
    assert.deepEqual(resolveResumeState(record, 3), { episodeIndex: 0, position: 0 });
    assert.deepEqual(resolveResumeState({ lastEpisodeIndex: -1, episodes: {} }, 3), {
        episodeIndex: 0,
        position: 0,
    });
    assert.deepEqual(resolveResumeState({ lastEpisodeIndex: 1.5, episodes: {} }, 3), {
        episodeIndex: 0,
        position: 0,
    });
});

test('resolveResumeState ignores non-positive/non-finite positions', () => {
    assert.deepEqual(resolveResumeState({ lastEpisodeIndex: 1, episodes: { 1: 0 } }, 3), {
        episodeIndex: 1,
        position: 0,
    });
    assert.deepEqual(resolveResumeState({ lastEpisodeIndex: 1, episodes: { 1: -5 } }, 3), {
        episodeIndex: 1,
        position: 0,
    });
    assert.deepEqual(resolveResumeState({ lastEpisodeIndex: 1, episodes: { 1: NaN } }, 3), {
        episodeIndex: 1,
        position: 0,
    });
});

test('upsertEpisodeProgress creates a new record', () => {
    const record = upsertEpisodeProgress(null, {
        key: 'k',
        seriesId: 's',
        seasonLink: 'sea',
        episodeIndex: 2,
        position: 33,
    });
    assert.equal(record.key, 'k');
    assert.equal(record.seriesId, 's');
    assert.equal(record.seasonLink, 'sea');
    assert.equal(record.lastEpisodeIndex, 2);
    assert.deepEqual(record.episodes, { 2: 33 });
    assert.equal(typeof record.updatedAt, 'number');
});

test('upsertEpisodeProgress merges per-episode positions and marks the last played', () => {
    const existing = {
        key: 'k',
        seriesId: 's',
        seasonLink: 'sea',
        lastEpisodeIndex: 0,
        episodes: { 0: 15 },
        updatedAt: 1,
    };
    const record = upsertEpisodeProgress(existing, {
        key: 'k',
        seriesId: 's',
        seasonLink: 'sea',
        episodeIndex: 1,
        position: 90,
    });
    assert.equal(record.lastEpisodeIndex, 1);
    assert.deepEqual(record.episodes, { 0: 15, 1: 90 });
    // Original record is untouched.
    assert.deepEqual(existing.episodes, { 0: 15 });
    assert.equal(existing.lastEpisodeIndex, 0);
});

test('upsertEpisodeProgress still records the last played without a valid position', () => {
    const record = upsertEpisodeProgress({ key: 'k', episodes: {} }, {
        key: 'k',
        seriesId: 's',
        seasonLink: 'sea',
        episodeIndex: 3,
        position: 0,
    });
    assert.equal(record.lastEpisodeIndex, 3);
    assert.deepEqual(record.episodes, { 3: 0 });
});

test('upsertSeriesProgress creates and replaces the last played season', () => {
    const first = upsertSeriesProgress(null, { seriesId: 's', seasonLink: 'sea1' });
    assert.equal(first.key, 's');
    assert.equal(first.seriesId, 's');
    assert.equal(first.lastSeasonLink, 'sea1');
    assert.equal(typeof first.updatedAt, 'number');

    const second = upsertSeriesProgress(first, { seriesId: 's', seasonLink: 'sea2' });
    assert.equal(second.lastSeasonLink, 'sea2');
    // Original object is untouched.
    assert.equal(first.lastSeasonLink, 'sea1');
});

test('resolveResumeSeasonLink only trusts links present in the season list', () => {
    const seasons = [{ link: 'sea1' }, { link: 'sea2' }];
    assert.equal(resolveResumeSeasonLink({ lastSeasonLink: 'sea2' }, seasons), 'sea2');
    assert.equal(resolveResumeSeasonLink({ lastSeasonLink: 'gone' }, seasons), null);
    assert.equal(resolveResumeSeasonLink({}, seasons), null);
    assert.equal(resolveResumeSeasonLink(null, seasons), null);
    assert.equal(resolveResumeSeasonLink({ lastSeasonLink: 'sea1' }, undefined), null);
});

test('IndexedDB helpers degrade gracefully without a browser', async () => {
    assert.equal(await loadSeasonProgress('s', 'sea'), null);
    assert.equal(await saveEpisodeProgress('s', 'sea', 0, 10), false);
    assert.equal(await loadSeriesProgress('s'), null);
    assert.equal(await saveSeriesProgress('s', 'sea'), false);
    assert.equal(PROGRESS_SAVE_INTERVAL_MS, 5000);
});
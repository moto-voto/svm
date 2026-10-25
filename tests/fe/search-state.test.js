import test from 'node:test';
import assert from 'node:assert/strict';

import {
    getStoredSearchState,
    saveSearchState,
    resolveSearchRestore,
} from '../../src/ui/search-state.js';

test('resolveSearchRestore restores the last search when coming back without ?q=', () => {
    // Back navigation from SeriesDetailsPage lands on `/` (no query).
    const stored = { items: [], stats: '5 / 5', query: 'one' };
    assert.deepEqual(resolveSearchRestore('', stored), { query: 'one', restored: stored });
});

test('resolveSearchRestore restores on reload of the same ?q=', () => {
    const stored = { items: [], stats: '5 / 5', query: 'one' };
    assert.deepEqual(resolveSearchRestore('one', stored), { query: 'one', restored: stored });
});

test('resolveSearchRestore lets the URL query win over the stored state', () => {
    // Deep link /?q=two while the session still holds results for "one".
    const stored = { items: [], stats: '5 / 5', query: 'one' };
    assert.deepEqual(resolveSearchRestore('two', stored), { query: 'two', restored: null });
});

test('resolveSearchRestore searches a URL query with no stored state (deep link)', () => {
    assert.deepEqual(resolveSearchRestore('one', null), { query: 'one', restored: null });
});

test('resolveSearchRestore triggers the initial search with neither URL nor storage', () => {
    assert.deepEqual(resolveSearchRestore('', null), { query: '', restored: null });
});

test('saveSearchState remembers and replaces the last search', () => {
    saveSearchState(null);
    assert.equal(getStoredSearchState(), null);

    const first = { items: [{ title: 'a' }], stats: '1 / 1', query: 'one' };
    saveSearchState(first);
    assert.equal(getStoredSearchState(), first);

    const second = { items: [], stats: '0 / 0', query: 'two' };
    saveSearchState(second);
    assert.equal(getStoredSearchState(), second);

    saveSearchState(null);
    assert.equal(getStoredSearchState(), null);
});

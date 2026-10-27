import test from 'node:test';
import assert from 'node:assert/strict';

import {
    getStoredBookmarksState,
    saveBookmarksState,
    invalidateBookmarksState,
    resolveBookmarksRestore,
} from '../../src/ui/bookmarks-state.js';

test('resolveBookmarksRestore restores the last listing when returning without ?q=', () => {
    // Back navigation from SeriesDetailsPage lands on `/bookmarks` (no query).
    const stored = { items: [], stats: '5 / 5', query: 'one' };
    assert.deepEqual(resolveBookmarksRestore('', stored), { query: 'one', restored: stored });
});

test('resolveBookmarksRestore restores on reload of the same ?q=', () => {
    const stored = { items: [], stats: '5 / 5', query: 'one' };
    assert.deepEqual(resolveBookmarksRestore('one', stored), { query: 'one', restored: stored });
});

test('resolveBookmarksRestore lets the URL query win over the stored state', () => {
    const stored = { items: [], stats: '5 / 5', query: 'one' };
    assert.deepEqual(resolveBookmarksRestore('two', stored), { query: 'two', restored: null });
});

test('resolveBookmarksRestore searches a URL query with no stored state (deep link)', () => {
    assert.deepEqual(resolveBookmarksRestore('one', null), { query: 'one', restored: null });
});

test('resolveBookmarksRestore triggers a fresh listing with neither URL nor storage', () => {
    assert.deepEqual(resolveBookmarksRestore('', null), { query: '', restored: null });
});

test('invalidateBookmarksState drops the snapshot so the next visit refetches', () => {
    const stored = { items: [{ title: 'a' }], stats: '1 / 1', query: 'one' };
    saveBookmarksState(stored);
    invalidateBookmarksState();
    assert.equal(getStoredBookmarksState(), null);
    // A toggle happened -> never restore the (stale) snapshot.
    assert.deepEqual(resolveBookmarksRestore('', getStoredBookmarksState()), { query: '', restored: null });
});

test('saveBookmarksState remembers and replaces the last listing', () => {
    saveBookmarksState(null);
    assert.equal(getStoredBookmarksState(), null);

    const first = { items: [{ title: 'a' }], stats: '1 / 1', query: 'one' };
    saveBookmarksState(first);
    assert.equal(getStoredBookmarksState(), first);

    const second = { items: [], stats: '0 / 0', query: 'two' };
    saveBookmarksState(second);
    assert.equal(getStoredBookmarksState(), second);

    saveBookmarksState(null);
    assert.equal(getStoredBookmarksState(), null);
});
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    getStoredHistoryState,
    saveHistoryState,
    invalidateHistoryState,
    resolveHistoryRestore,
} from '../../src/ui/history-state.js';

test('resolveHistoryRestore restores the last listing when returning without ?q=', () => {
    // Back navigation from SeriesDetailsPage lands on `/history` (no query).
    const stored = { items: [], stats: '5 / 5', query: 'one' };
    assert.deepEqual(resolveHistoryRestore('', stored), { query: 'one', restored: stored });
});

test('resolveHistoryRestore restores on reload of the same ?q=', () => {
    const stored = { items: [], stats: '5 / 5', query: 'one' };
    assert.deepEqual(resolveHistoryRestore('one', stored), { query: 'one', restored: stored });
});

test('resolveHistoryRestore lets the URL query win over the stored state', () => {
    const stored = { items: [], stats: '5 / 5', query: 'one' };
    assert.deepEqual(resolveHistoryRestore('two', stored), { query: 'two', restored: null });
});

test('resolveHistoryRestore searches a URL query with no stored state (deep link)', () => {
    assert.deepEqual(resolveHistoryRestore('one', null), { query: 'one', restored: null });
});

test('resolveHistoryRestore triggers a fresh listing with neither URL nor storage', () => {
    assert.deepEqual(resolveHistoryRestore('', null), { query: '', restored: null });
});

test('invalidateHistoryState drops the snapshot so the next visit refetches', () => {
    const stored = { items: [{ title: 'a' }], stats: '1 / 1', query: 'one' };
    saveHistoryState(stored);
    invalidateHistoryState();
    assert.equal(getStoredHistoryState(), null);
    // A watch event happened -> never restore the (stale) snapshot.
    assert.deepEqual(resolveHistoryRestore('', getStoredHistoryState()), { query: '', restored: null });
});

test('saveHistoryState remembers and replaces the last listing', () => {
    saveHistoryState(null);
    assert.equal(getStoredHistoryState(), null);

    const first = { items: [{ title: 'a' }], stats: '1 / 1', query: 'one' };
    saveHistoryState(first);
    assert.equal(getStoredHistoryState(), first);

    const second = { items: [], stats: '0 / 0', query: 'two' };
    saveHistoryState(second);
    assert.equal(getStoredHistoryState(), second);

    saveHistoryState(null);
    assert.equal(getStoredHistoryState(), null);
});
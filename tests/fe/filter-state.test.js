import test from 'node:test';
import assert from 'node:assert/strict';

import {
    getStoredFilterState,
    saveFilterState,
    resolveFilterRestore,
} from '../../src/ui/filter-state.js';

test('resolveFilterRestore restores the last filter on a bare URL (switcher visit)', () => {
    // Clicking "Фильтр" in the view switcher lands on `/filter` (no params);
    // the session's last filter is reused.
    const stored = { items: [], stats: '5 / 5', genre: '19', country: 'all' };
    assert.deepEqual(resolveFilterRestore(undefined, undefined, stored), {
        genre: '19',
        country: 'all',
        restored: stored,
    });
});

test('resolveFilterRestore reuses the full last filter on a bare URL', () => {
    const stored = { items: [], stats: '5 / 5', genre: '19', country: 'США' };
    assert.deepEqual(resolveFilterRestore(undefined, undefined, stored), {
        genre: '19',
        country: 'США',
        restored: stored,
    });
});

test('resolveFilterRestore restores on reload of the same ?g=/?c=', () => {
    const stored = { items: [], stats: '5 / 5', genre: '19', country: 'США' };
    assert.deepEqual(resolveFilterRestore('19', 'США', stored), {
        genre: '19',
        country: 'США',
        restored: stored,
    });
});

test('resolveFilterRestore lets the URL values win over the stored state', () => {
    const stored = { items: [], stats: '5 / 5', genre: '19', country: 'all' };
    // Deep link ?g=1&c=США while the session still holds 19/all.
    assert.deepEqual(resolveFilterRestore('1', 'США', stored), {
        genre: '1',
        country: 'США',
        restored: null,
    });
});

test('resolveFilterRestore searches a URL filter with no stored state (deep link)', () => {
    assert.deepEqual(resolveFilterRestore('7', undefined, null), { genre: '7', country: 'all', restored: null });
});

test('resolveFilterRestore defaults to all with neither URL nor storage', () => {
    assert.deepEqual(resolveFilterRestore(undefined, undefined, null), {
        genre: 'all',
        country: 'all',
        restored: null,
    });
});

test('resolveFilterRestore does not restore a state for a different country', () => {
    const stored = { items: [], stats: '5 / 5', genre: '19', country: 'США' };
    const resolved = resolveFilterRestore('19', undefined, stored);
    assert.equal(resolved.genre, '19');
    assert.equal(resolved.country, 'all');
    assert.equal(resolved.restored, null);
});

test('saveFilterState remembers and replaces the last filter', () => {
    saveFilterState(null);
    assert.equal(getStoredFilterState(), null);

    const first = { items: [{ title: 'a' }], stats: '1 / 1', genre: '19', country: 'all' };
    saveFilterState(first);
    assert.equal(getStoredFilterState(), first);

    const second = { items: [], stats: '0 / 0', genre: 'all', country: 'США' };
    saveFilterState(second);
    assert.equal(getStoredFilterState(), second);

    saveFilterState(null);
    assert.equal(getStoredFilterState(), null);
});
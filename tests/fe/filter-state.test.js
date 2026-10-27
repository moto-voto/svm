import test from 'node:test';
import assert from 'node:assert/strict';

import {
    getStoredFilterState,
    saveFilterState,
    resolveFilterRestore,
} from '../../src/ui/filter-state.js';

function createLocalStorage() {
    const store = new Map();
    return {
        getItem(key) {
            const value = store.get(String(key));
            return value === undefined ? null : value;
        },
        setItem(key, value) {
            store.set(String(key), String(value));
        },
        removeItem(key) {
            store.delete(String(key));
        },
        clear() {
            store.clear();
        },
    };
}

function withLocalStorage(fn) {
    const original = globalThis.localStorage;
    const storage = createLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
        value: storage,
        writable: true,
        configurable: true,
    });
    try {
        return fn(storage);
    } finally {
        if (original === undefined) {
            delete globalThis.localStorage;
        } else {
            Object.defineProperty(globalThis, 'localStorage', {
                value: original,
                writable: true,
                configurable: true,
            });
        }
    }
}

test('resolveFilterRestore restores the last filter on a bare URL (switcher visit)', () => {
    // Clicking "Фильтр" in the view switcher lands on `/filter` (no params);
    // the session's last filter is reused.
    const stored = { items: [], stats: '5 / 5', genre: '19', country: 'all', sort: 'imdb' };
    assert.deepEqual(resolveFilterRestore(undefined, undefined, undefined, stored), {
        genre: '19',
        country: 'all',
        sort: 'imdb',
        restored: stored,
    });
});

test('resolveFilterRestore reuses the full last filter on a bare URL', () => {
    const stored = { items: [], stats: '5 / 5', genre: '19', country: 'США', sort: 'view' };
    assert.deepEqual(resolveFilterRestore(undefined, undefined, undefined, stored), {
        genre: '19',
        country: 'США',
        sort: 'view',
        restored: stored,
    });
});

test('resolveFilterRestore restores on reload of the same ?g=/?c=/?s=', () => {
    const stored = { items: [], stats: '5 / 5', genre: '19', country: 'США', sort: 'view' };
    assert.deepEqual(resolveFilterRestore('19', 'США', 'view', stored), {
        genre: '19',
        country: 'США',
        sort: 'view',
        restored: stored,
    });
});

test('resolveFilterRestore lets the URL values win over the stored state', () => {
    const stored = { items: [], stats: '5 / 5', genre: '19', country: 'all', sort: 'imdb' };
    // Deep link ?g=1&c=США&s=god while the session still holds 19/all/imdb.
    assert.deepEqual(resolveFilterRestore('1', 'США', 'god', stored), {
        genre: '1',
        country: 'США',
        sort: 'god',
        restored: null,
    });
});

test('resolveFilterRestore searches a URL filter with no stored state (deep link)', () => {
    assert.deepEqual(resolveFilterRestore('7', undefined, undefined, null), {
        genre: '7',
        country: 'all',
        sort: 'name',
        restored: null,
    });
});

test('resolveFilterRestore defaults to all/name with neither URL nor storage', () => {
    assert.deepEqual(resolveFilterRestore(undefined, undefined, undefined, null), {
        genre: 'all',
        country: 'all',
        sort: 'name',
        restored: null,
    });
});

test('resolveFilterRestore normalizes a URL sort to the default when missing', () => {
    const stored = { items: [], stats: '5 / 5', genre: '19', country: 'США', sort: 'view' };
    // ?g=19&c=США without ?s= -> sort comes from the URL default (name), so
    // the stored 'view' listing must not be restored.
    assert.deepEqual(resolveFilterRestore('19', 'США', undefined, stored), {
        genre: '19',
        country: 'США',
        sort: 'name',
        restored: null,
    });
});

test('resolveFilterRestore does not restore a state for a different sort', () => {
    const stored = { items: [], stats: '5 / 5', genre: '19', country: 'США', sort: 'view' };
    const resolved = resolveFilterRestore('19', 'США', 'imdb', stored);
    assert.equal(resolved.sort, 'imdb');
    assert.equal(resolved.restored, null);
});

test('saveFilterState remembers and replaces the last filter', () => {
    saveFilterState(null);
    assert.equal(getStoredFilterState(), null);

    const first = { items: [{ title: 'a' }], stats: '1 / 1', genre: '19', country: 'all', sort: 'name' };
    saveFilterState(first);
    assert.equal(getStoredFilterState(), first);

    const second = { items: [], stats: '0 / 0', genre: 'all', country: 'США', sort: 'imdb' };
    saveFilterState(second);
    assert.equal(getStoredFilterState(), second);

    saveFilterState(null);
    assert.equal(getStoredFilterState(), null);
});

test('saveFilterState persists filter values to localStorage', () => {
    withLocalStorage((storage) => {
        saveFilterState(null);
        const first = { items: [{ title: 'a' }], stats: '1 / 1', genre: '19', country: 'all', sort: 'name' };
        saveFilterState(first);
        const raw = storage.getItem('svm:filter:last');
        assert.ok(raw);
        assert.deepEqual(JSON.parse(raw), { genre: '19', country: 'all', sort: 'name' });

        const second = { items: [], stats: '0 / 0', genre: 'all', country: 'США', sort: 'imdb' };
        saveFilterState(second);
        assert.deepEqual(JSON.parse(storage.getItem('svm:filter:last')), { genre: 'all', country: 'США', sort: 'imdb' });

        saveFilterState(null);
        assert.equal(storage.getItem('svm:filter:last'), null);
    });
});

test('resolveFilterRestore reads filter values from localStorage on bare URL after reload', () => {
    withLocalStorage((storage) => {
        saveFilterState(null);
        storage.setItem('svm:filter:last', JSON.stringify({ genre: '7', country: 'Россия', sort: 'view' }));
        assert.deepEqual(resolveFilterRestore(undefined, undefined, undefined, null), {
            genre: '7',
            country: 'Россия',
            sort: 'view',
            restored: null,
        });
        saveFilterState(null);
    });
});

test('resolveFilterRestore prefers localStorage over defaults on bare URL', () => {
    withLocalStorage((storage) => {
        saveFilterState(null);
        storage.setItem('svm:filter:last', JSON.stringify({ genre: '1', country: 'all', sort: 'god' }));
        assert.deepEqual(resolveFilterRestore(undefined, undefined, undefined, null), {
            genre: '1',
            country: 'all',
            sort: 'god',
            restored: null,
        });
        saveFilterState(null);
    });
});

test('URL params take precedence over localStorage values', () => {
    withLocalStorage((storage) => {
        saveFilterState(null);
        storage.setItem('svm:filter:last', JSON.stringify({ genre: '7', country: 'Россия', sort: 'view' }));
        assert.deepEqual(resolveFilterRestore('19', undefined, undefined, null), {
            genre: '19',
            country: 'all',
            sort: 'name',
            restored: null,
        });
        saveFilterState(null);
    });
});

test('localStorage values are normalized on read', () => {
    withLocalStorage((storage) => {
        saveFilterState(null);
        storage.setItem('svm:filter:last', JSON.stringify({ genre: '  ', country: null, sort: '' }));
        assert.deepEqual(resolveFilterRestore(undefined, undefined, undefined, null), {
            genre: 'all',
            country: 'all',
            sort: 'name',
            restored: null,
        });
        saveFilterState(null);
    });
});
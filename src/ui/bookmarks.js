/**
 * Bookmark persistence backed by the browser's IndexedDB.
 *
 * Bookmarks are stored per series in a single record:
 *
 * ```js
 * {
 *   key: string,              // seriesId (idSerial when available, else series URL)
 *   seriesId: string,
 *   title: string,
 *   image: string | null,
 *   fullLink: string,
 *   addedAt: number,          // epoch ms when the series was bookmarked
 * }
 * ```
 *
 * Series are listed in the order they were bookmarked (most recent first via
 * `addedAt`). All pure helpers are exported separately so they can be unit
 * tested without a DOM/IndexedDB environment. The async helpers degrade
 * gracefully to no-ops when IndexedDB is unavailable (SSR / tests /
 * private-mode failures).
 */

export const BOOKMARKS_DB_NAME = 'svm-bookmarks';
export const BOOKMARKS_DB_VERSION = 1;
export const BOOKMARKS_STORE_NAME = 'bookmarks';

/**
 * Merge a bookmark upsert into an existing record. `title`/`image`/`fullLink`
 * are only overwritten when the update provides a truthy value, and `addedAt`
 * is kept from the existing record so re-saving never reorders the list.
 * Returns a fresh object (no mutation).
 * @param {Bookmark | null | undefined} existing
 * @param {{
 *   seriesId: string,
 *   title?: string,
 *   image?: string | null,
 *   fullLink?: string,
 * }} update
 * @returns {Bookmark}
 */
export function buildBookmark(existing, update) {
    const { seriesId, title, image, fullLink } = update;
    /** @type {Bookmark} */
    const record = {
        ...(existing || {}),
        key: seriesId,
        seriesId,
        title: existing?.title ?? '',
        image: existing?.image ?? null,
        fullLink: existing?.fullLink ?? '',
        addedAt: existing?.addedAt ?? Date.now(),
    };
    if (title) record.title = title;
    if (image) record.image = image;
    if (fullLink) record.fullLink = fullLink;
    return record;
}

/**
 * Sort bookmarks by the order they were added, newest first (stable for
 * records with equal timestamps). Does not mutate the input.
 * @param {Bookmark[]} records
 * @returns {Bookmark[]}
 */
export function sortBookmarksByAdded(records) {
    return [...(records || [])].sort((a, b) => (b?.addedAt || 0) - (a?.addedAt || 0));
}

/**
 * Case-insensitive title filter used by the bookmarks page's search box.
 * An empty/whitespace query returns everything.
 * @param {Bookmark[]} records
 * @param {string} query
 * @returns {Bookmark[]}
 */
export function filterBookmarksByQuery(records, query) {
    const q = String(query ?? '').trim().toLowerCase();
    if (!q) return records;
    return records.filter((record) => String(record?.title ?? '').toLowerCase().includes(q));
}

/**
 * Map a stored bookmark to the tile shape consumed by VirtualGrid.
 * @param {Bookmark} record
 * @returns {BookmarkTile}
 */
export function toBookmarkTile(record) {
    return {
        id: record?.seriesId || '',
        title: record?.title || '',
        image: record?.image || null,
        fullLink: record?.fullLink || '',
    };
}

/**
 * Turn stored bookmarks into searchable, clickable grid tiles: filter by the
 * query, drop records that cannot be opened (missing series link) and map
 * each remaining record to the tile shape.
 * @param {Bookmark[]} records
 * @param {string} query
 * @returns {BookmarkTile[]}
 */
export function buildBookmarkTiles(records, query) {
    return filterBookmarksByQuery(records, query)
        .filter((record) => record && record.fullLink)
        .map(toBookmarkTile);
}

/** @type {Promise<IDBDatabase | null> | undefined} */
let dbPromise;

/**
 * Open (and lazily create) the bookmarks database. Resolves `null` when
 * IndexedDB is unavailable or cannot be opened.
 * @returns {Promise<IDBDatabase | null>}
 */
export function openBookmarksDB() {
    if (typeof indexedDB === 'undefined') return Promise.resolve(null);
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(BOOKMARKS_DB_NAME, BOOKMARKS_DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(BOOKMARKS_STORE_NAME)) {
                db.createObjectStore(BOOKMARKS_STORE_NAME, { keyPath: 'key' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('IndexedDB blocked'));
    }).catch(() => null);
    return dbPromise;
}

/**
 * Read all bookmarks, most recently added first. Resolves an empty array
 * when IndexedDB is unavailable.
 * @returns {Promise<Bookmark[]>}
 */
export async function loadBookmarks() {
    const db = await openBookmarksDB();
    if (!db) return [];
    return new Promise((resolve) => {
        let request;
        try {
            request = db.transaction(BOOKMARKS_STORE_NAME, 'readonly').objectStore(BOOKMARKS_STORE_NAME).getAll();
        } catch {
            resolve([]);
            return;
        }
        request.onsuccess = () => resolve(sortBookmarksByAdded(request.result || []));
        request.onerror = () => resolve([]);
    });
}

/**
 * Whether a series is bookmarked.
 * @param {string} seriesId
 * @returns {Promise<boolean>}
 */
export async function isBookmarked(seriesId) {
    const db = await openBookmarksDB();
    if (!db) return false;
    return new Promise((resolve) => {
        let request;
        try {
            request = db.transaction(BOOKMARKS_STORE_NAME, 'readonly').objectStore(BOOKMARKS_STORE_NAME).get(seriesId);
        } catch {
            resolve(false);
            return;
        }
        request.onsuccess = () => resolve(Boolean(request.result));
        request.onerror = () => resolve(false);
    });
}

/**
 * Add a series to the bookmarks (idempotent upsert). Returns false when
 * IndexedDB is unavailable.
 * @param {string} seriesId
 * @param {{
 *   title?: string,
 *   image?: string | null,
 *   fullLink?: string,
 * }} update
 * @returns {Promise<boolean>}
 */
export async function saveBookmark(seriesId, update) {
    const db = await openBookmarksDB();
    if (!db) return false;
    return new Promise((resolve) => {
        let tx;
        try {
            tx = db.transaction(BOOKMARKS_STORE_NAME, 'readwrite');
        } catch {
            resolve(false);
            return;
        }
        const store = tx.objectStore(BOOKMARKS_STORE_NAME);
        const getRequest = store.get(seriesId);
        getRequest.onsuccess = () => {
            store.put(buildBookmark(getRequest.result, { seriesId, ...update }));
        };
        getRequest.onerror = () => {
            store.put(buildBookmark(null, { seriesId, ...update }));
        };
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
        tx.onabort = () => resolve(false);
    });
}

/**
 * Remove a series from the bookmarks. Returns false when IndexedDB is
 * unavailable.
 * @param {string} seriesId
 * @returns {Promise<boolean>}
 */
export async function removeBookmark(seriesId) {
    const db = await openBookmarksDB();
    if (!db) return false;
    return new Promise((resolve) => {
        let tx;
        try {
            tx = db.transaction(BOOKMARKS_STORE_NAME, 'readwrite');
        } catch {
            resolve(false);
            return;
        }
        tx.objectStore(BOOKMARKS_STORE_NAME).delete(seriesId);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
        tx.onabort = () => resolve(false);
    });
}

/**
 * @typedef Bookmark
 * @property {string} key
 * @property {string} seriesId
 * @property {string} title
 * @property {string | null} image
 * @property {string} fullLink
 * @property {number} addedAt epoch ms when the series was bookmarked
 */

/**
 * Tile shape consumed by the bookmarks page's virtual grid.
 * @typedef BookmarkTile
 * @property {string} id
 * @property {string} title
 * @property {string | null} image
 * @property {string} fullLink
 */
/**
 * Watch-progress persistence backed by the browser's IndexedDB.
 *
 * Progress is stored per **series + season** in a single record:
 *
 * ```js
 * {
 *   key: string,              // `seriesId::seasonLink`
 *   seriesId: string,
 *   seasonLink: string,
 *   lastEpisodeIndex: number, // last played episode in this season
 *   episodes: { [index: number]: number }, // episode index -> seconds
 *   updatedAt: number,        // epoch ms
 * }
 * ```
 *
 * The last played season is stored per series in its own record:
 *
 * ```js
 * { key: seriesId, seriesId, lastSeasonLink, updatedAt }
 * ```
 *
 * All pure helpers are exported separately so they can be unit tested without
 * a DOM/IndexedDB environment. The async helpers degrade gracefully to no-ops
 * when IndexedDB is unavailable (SSR / tests / private-mode failures).
 */

export const DB_NAME = 'svm-watch-progress';
export const DB_VERSION = 3;
export const STORE_NAME = 'seasonProgress';
export const SERIES_STORE_NAME = 'seriesProgress';

/** How often `timeupdate` may flush progress to disk (ms). */
export const PROGRESS_SAVE_INTERVAL_MS = 5000;

/**
 * Stable key for a series + season pair. `seriesId` is the serial id when
 * available, otherwise it falls back to the series URL.
 * @param {string} seriesId
 * @param {string} seasonLink
 */
export function watchProgressKey(seriesId, seasonLink) {
    return `${seriesId || ''}::${seasonLink || ''}`;
}

/**
 * Pick the episode/position to resume from, guarding against a stale record
 * that points past the end of the current playlist.
 * @param {SeasonProgress | null | undefined} record
 * @param {number} episodeCount
 * @returns {{ episodeIndex: number, position: number }}
 */
export function resolveResumeState(record, episodeCount) {
    if (!record || !episodeCount || episodeCount <= 0) {
        return { episodeIndex: 0, position: 0 };
    }
    const rawIndex = record.lastEpisodeIndex;
    const episodeIndex =
        Number.isInteger(rawIndex) && rawIndex >= 0 && rawIndex < episodeCount ? rawIndex : 0;
    const rawPosition = record.episodes?.[episodeIndex];
    const position = Number.isFinite(rawPosition) && rawPosition > 0 ? rawPosition : 0;
    return { episodeIndex, position };
}

/**
 * Merge a new episode position into an existing record, marking the episode as
 * the last played one. Returns a fresh object (no mutation).
 * @param {SeasonProgress | null | undefined} existing
 * @param {{ key: string, seriesId: string, seasonLink: string, episodeIndex: number, position: number }} update
 * @returns {SeasonProgress}
 */
export function upsertEpisodeProgress(existing, update) {
    const { key, seriesId, seasonLink, episodeIndex, position } = update;
    /** @type {Record<number, number>} */
    const episodes = { ...(existing?.episodes || {}) };
    if (Number.isFinite(position) && position >= 0) {
        episodes[episodeIndex] = position;
    }
    return {
        key,
        seriesId,
        seasonLink,
        lastEpisodeIndex: episodeIndex,
        episodes,
        updatedAt: Date.now(),
    };
}

/**
 * Merge the last played season into an existing series record. Returns a fresh
 * object (no mutation).
 * @param {SeriesProgress | null | undefined} existing
 * @param {{ seriesId: string, seasonLink: string }} update
 * @returns {SeriesProgress}
 */
export function upsertSeriesProgress(existing, update) {
    const { seriesId, seasonLink } = update;
    return {
        key: seriesId,
        seriesId,
        lastSeasonLink: seasonLink,
        updatedAt: Date.now(),
    };
}

/**
 * Resolve the stored last-played season link, but only when it still exists in
 * the freshly loaded season list. Returns `null` when it cannot be trusted.
 * @param {SeriesProgress | null | undefined} record
 * @param {{ link?: string }[]} seasons
 * @returns {string | null}
 */
export function resolveResumeSeasonLink(record, seasons) {
    const link = record?.lastSeasonLink;
    if (!link || !Array.isArray(seasons)) return null;
    return seasons.some((season) => season && season.link === link) ? link : null;
}

/** @type {Promise<IDBDatabase | null> | undefined} */
let dbPromise;

/**
 * Open (and lazily create) the progress database. Resolves `null` when
 * IndexedDB is unavailable or cannot be opened.
 * @returns {Promise<IDBDatabase | null>}
 */
export function openProgressDB() {
    if (typeof indexedDB === 'undefined') return Promise.resolve(null);
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'key' });
            }
            if (!db.objectStoreNames.contains(SERIES_STORE_NAME)) {
                db.createObjectStore(SERIES_STORE_NAME, { keyPath: 'key' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('IndexedDB blocked'));
    }).catch(() => null);
    return dbPromise;
}

/**
 * Read the saved progress for a season.
 * @param {string} seriesId
 * @param {string} seasonLink
 * @returns {Promise<SeasonProgress | null>}
 */
export async function loadSeasonProgress(seriesId, seasonLink) {
    const db = await openProgressDB();
    if (!db) return null;
    const key = watchProgressKey(seriesId, seasonLink);
    return new Promise((resolve) => {
        let request;
        try {
            request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);
        } catch {
            resolve(null);
            return;
        }
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
    });
}

/**
 * Persist the position for one episode and mark it as the season's last played
 * episode.
 * @param {string} seriesId
 * @param {string} seasonLink
 * @param {number} episodeIndex
 * @param {number} position seconds
 * @returns {Promise<boolean>}
 */
export async function saveEpisodeProgress(seriesId, seasonLink, episodeIndex, position) {
    const db = await openProgressDB();
    if (!db) return false;
    const key = watchProgressKey(seriesId, seasonLink);
    return new Promise((resolve) => {
        let tx;
        try {
            tx = db.transaction(STORE_NAME, 'readwrite');
        } catch {
            resolve(false);
            return;
        }
        const store = tx.objectStore(STORE_NAME);
        const getRequest = store.get(key);
        getRequest.onsuccess = () => {
            const record = upsertEpisodeProgress(getRequest.result, {
                key,
                seriesId,
                seasonLink,
                episodeIndex,
                position,
            });
            store.put(record);
        };
        getRequest.onerror = () => {
            const record = upsertEpisodeProgress(null, {
                key,
                seriesId,
                seasonLink,
                episodeIndex,
                position,
            });
            store.put(record);
        };
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
        tx.onabort = () => resolve(false);
    });
}

/**
 * Read the saved last-played season for a series.
 * @param {string} seriesId
 * @returns {Promise<SeriesProgress | null>}
 */
export async function loadSeriesProgress(seriesId) {
    const db = await openProgressDB();
    if (!db) return null;
    return new Promise((resolve) => {
        let request;
        try {
            request = db.transaction(SERIES_STORE_NAME, 'readonly').objectStore(SERIES_STORE_NAME).get(seriesId);
        } catch {
            resolve(null);
            return;
        }
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
    });
}

/**
 * Persist the last-played season for a series.
 * @param {string} seriesId
 * @param {string} seasonLink
 * @returns {Promise<boolean>}
 */
export async function saveSeriesProgress(seriesId, seasonLink) {
    const db = await openProgressDB();
    if (!db) return false;
    return new Promise((resolve) => {
        let tx;
        try {
            tx = db.transaction(SERIES_STORE_NAME, 'readwrite');
        } catch {
            resolve(false);
            return;
        }
        const store = tx.objectStore(SERIES_STORE_NAME);
        const getRequest = store.get(seriesId);
        getRequest.onsuccess = () => {
            store.put(upsertSeriesProgress(getRequest.result, { seriesId, seasonLink }));
        };
        getRequest.onerror = () => {
            store.put(upsertSeriesProgress(null, { seriesId, seasonLink }));
        };
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
        tx.onabort = () => resolve(false);
    });
}

/**
 * @typedef SeasonProgress
 * @property {string} key
 * @property {string} seriesId
 * @property {string} seasonLink
 * @property {number} lastEpisodeIndex
 * @property {Record<number, number>} episodes
 * @property {number} updatedAt
 */

/**
 * @typedef SeriesProgress
 * @property {string} key
 * @property {string} seriesId
 * @property {string} lastSeasonLink
 * @property {number} updatedAt
 */
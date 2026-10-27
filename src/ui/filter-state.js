//
// In-memory filter-results state for the Filter page (see `pages/FilterPage.jsx`
// and the `/api/series-filter` endpoint).
//
// Same rationale as `search-state.js`: navigating to the details/player page
// unmounts the filter page, but module-level state survives client-side
// navigation, so coming back restores the filtered tiles and the viewport
// position without a new request. Filter values and sorting are also saved
// in localStorage so they persist between page reloads.
//

/** @import { SerialDescription } from '../parser/search.js' */

import { normalizeFilterValue, normalizeSortValue, ALL_VALUE, DEFAULT_SORT } from './filter-options.js';

const STORAGE_KEY = 'svm:filter:last';

/**
 * @typedef {Object} FilterState
 * @property {SerialDescription[]} items
 * @property {string} stats
 * @property {string} genre normalized genre id the results belong to ('all' when unset)
 * @property {string} country normalized country name the results belong to ('all' when unset)
 * @property {string} sort normalized sort option the results belong to ('name' when unset)
 * @property {{ index: number, offset: number } | null} [anchor] viewport
 *   position: top-most visible item and the scroll offset past its top edge
 *   (see `anchorFor` in `grid-layout.js`) — restored when the user comes back
 */

/** @typedef {Object} StoredFilterValues
 * @property {string} [genre]
 * @property {string} [country]
 * @property {string} [sort]
 */

/**
 * Safely access localStorage in environments where it may not exist.
 * @returns {Storage | null}
 */
function getStorage() {
    try {
        if (typeof localStorage !== 'undefined') {
            return localStorage;
        }
    } catch {
        // ignore
    }
    return null;
}

/**
 * Load filter values from localStorage.
 * @returns {{ genre: string, country: string, sort: string } | null}
 */
function loadFromStorage() {
    const storage = getStorage();
    if (!storage) return null;
    try {
        const raw = storage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        const genre = normalizeFilterValue(parsed.genre);
        const country = normalizeFilterValue(parsed.country);
        const sort = normalizeSortValue(parsed.sort);
        return { genre, country, sort };
    } catch {
        return null;
    }
}

/**
 * Save filter values to localStorage.
 * @param {{ genre: string, country: string, sort: string } | null} values
 */
function saveToStorage(values) {
    const storage = getStorage();
    if (!storage) return;
    try {
        if (!values) {
            storage.removeItem(STORAGE_KEY);
            return;
        }
        const payload = {
            genre: normalizeFilterValue(values.genre),
            country: normalizeFilterValue(values.country),
            sort: normalizeSortValue(values.sort),
        };
        storage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
        // ignore
    }
}

/** @type {FilterState | null} */
let state = null;

/**
 * State of the last executed filter in this SPA session, or `null` when
 * there is none (fresh session).
 * @returns {FilterState | null}
 */
export function getStoredFilterState() {
    return state;
}

/**
 * Remember the results of a completed filter (or clear the slot with `null`).
 * @param {FilterState | null} next
 */
export function saveFilterState(next) {
    state = next;
    if (next) {
        saveToStorage({ genre: next.genre, country: next.country, sort: next.sort });
    } else {
        saveToStorage(null);
    }
}

/**
 * Decide what the filter page should show on mount.
 *
 * When the URL carries any filter parameter (`?g=`/`?c=`/`?s=`) those values
 * win (deep link / reload) and the stored state is only reused when it
 * belongs to the same genre+country+sort triple. A bare `/filter` URL (no
 * parameters — e.g. coming from another view via the switcher) reuses the
 * last filter applied in this session, falling back to values from
 * localStorage, otherwise all/all/name.
 *
 * @param {string | undefined} rawGenre raw `?g=` value (undefined when absent)
 * @param {string | undefined} rawCountry raw `?c=` value (undefined when absent)
 * @param {string | undefined} rawSort raw `?s=` value (undefined when absent)
 * @param {FilterState | null} stored last filter in this session (or null)
 * @returns {{
 *   genre: string,
 *   country: string,
 *   sort: string,
 *   restored: FilterState | null,
 * }} `genre`/`country`/`sort` are the effective values to display/filter;
 *   `restored` is the stored state that can be shown as-is without a new
 *   request, or null when a filter request must run.
 */
export function resolveFilterRestore(rawGenre, rawCountry, rawSort, stored) {
    const urlProvided = rawGenre !== undefined || rawCountry !== undefined || rawSort !== undefined;
    const storageValues = urlProvided ? null : loadFromStorage();
    const genre = urlProvided
        ? normalizeFilterValue(rawGenre)
        : (stored?.genre ?? storageValues?.genre ?? ALL_VALUE);
    const country = urlProvided
        ? normalizeFilterValue(rawCountry)
        : (stored?.country ?? storageValues?.country ?? ALL_VALUE);
    const sort = urlProvided
        ? normalizeSortValue(rawSort)
        : (stored?.sort ?? storageValues?.sort ?? DEFAULT_SORT);
    const restored =
        stored && stored.genre === genre && stored.country === country && stored.sort === sort ? stored : null;
    return { genre, country, sort, restored };
}
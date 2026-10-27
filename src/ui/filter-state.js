//
// In-memory filter-results state for the Filter page (see `pages/FilterPage.jsx`
// and the `/api/series-filter` endpoint).
//
// Same rationale as `search-state.js`: navigating to the details/player page
// unmounts the filter page, but module-level state survives client-side
// navigation, so coming back restores the filtered tiles and the viewport
// position without a new request. A reload intentionally starts fresh — the
// `?g=...&c=...` URL parameters are the durable state.
//

/** @import { SerialDescription } from '../parser/search.js' */

import { normalizeFilterValue, normalizeSortValue, ALL_VALUE, DEFAULT_SORT } from './filter-options.js';

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
}

/**
 * Decide what the filter page should show on mount.
 *
 * When the URL carries any filter parameter (`?g=`/`?c=`/`?s=`) those values
 * win (deep link / reload) and the stored state is only reused when it
 * belongs to the same genre+country+sort triple. A bare `/filter` URL (no
 * parameters — e.g. coming from another view via the switcher) reuses the
 * last filter applied in this session, falling back to all/all/name.
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
    const genre = urlProvided ? normalizeFilterValue(rawGenre) : (stored?.genre ?? ALL_VALUE);
    const country = urlProvided ? normalizeFilterValue(rawCountry) : (stored?.country ?? ALL_VALUE);
    const sort = urlProvided ? normalizeSortValue(rawSort) : (stored?.sort ?? DEFAULT_SORT);
    const restored =
        stored && stored.genre === genre && stored.country === country && stored.sort === sort ? stored : null;
    return { genre, country, sort, restored };
}
//
// In-memory search-results state (see `pages/SearchPage.jsx`).
//
// This is an SPA: navigating from the search page to SeriesDetailsPage
// unmounts the search page, but module-level state survives client-side
// navigation. The results and query of the last completed search are kept
// here and restored when the user comes back — no new search is performed.
//
// Deliberately *not* `localStorage`: a reload (or a new tab) intentionally
// starts fresh — the `?q=` URL parameter is the durable, shareable state, so
// `/?q=...` deep links and reloads always search what the URL says. In-memory
// state also needs no expiry, serialization or cross-tab invalidation.
//

/** @import { SerialDescription } from '../parser/search.js' */

/**
 * @typedef {Object} SearchState
 * @property {SerialDescription[]} items
 * @property {string} stats
 * @property {string} query normalized query the results belong to
 * @property {{ index: number, offset: number } | null} [anchor] viewport
 *   position: top-most visible item and the scroll offset past its top edge
 *   (see `anchorFor` in `grid-layout.js`) — restored when the user comes back
 */

/** @type {SearchState | null} */
let state = null;

/**
 * State of the last completed search in this SPA session, or `null` when
 * there is none (fresh session).
 * @returns {SearchState | null}
 */
export function getStoredSearchState() {
    return state;
}

/**
 * Remember the results of a completed search (or clear the slot with `null`).
 * @param {SearchState | null} next
 */
export function saveSearchState(next) {
    state = next;
}

/**
 * Decide what the search page should show on mount.
 *
 * The URL query wins over the stored one (deep link / reload), while the
 * stored state is only reused when it belongs to the same query — coming
 * back from SeriesDetailsPage lands on `/` (no `?q=`), so the stored query
 * fills the gap and must be reflected in the URL again.
 *
 * @param {string} urlQuery normalized `?q=` value ('' when absent)
 * @param {SearchState | null} stored last search in this session (or null)
 * @returns {{ query: string, restored: SearchState | null }} `query` is the
 *   effective query to display/search; `restored` is the stored state that
 *   can be shown as-is without a new request, or null when a search must run.
 */
export function resolveSearchRestore(urlQuery, stored) {
    const query = urlQuery || (stored?.query ?? '');
    return { query, restored: stored && stored.query === query ? stored : null };
}

/**
 * @typedef {Object} FilterState
 * @property {string[]} genreIds genre filter selection (empty array means "all")
 * @property {string[]} countryIds country filter selection (empty array means "all")
 * @property {boolean} isFilterMode whether the filter panel is open
 */

/** @type {FilterState} */
let filterState = {
    genreIds: [],
    countryIds: [],
    isFilterMode: false
};

/**
 * Get the current filter state.
 * @returns {FilterState}
 */
export function getFilterState() {
    return filterState;
}

/**
 * Set the filter state and trigger a new search.
 * @param {Partial<FilterState>} updates
 */
export function setFilterState(updates) {
    filterState = { ...filterState, ...updates };
}

/**
 * Clear all filters and reset to filter mode off.
 */
export function clearFilters() {
    filterState = {
        genreIds: [],
        countryIds: [],
        isFilterMode: false
    };
}

/**
 * Build a filter URL string for deep linking and restore.
 * @returns {string}
 */
export function buildFilterUrl() {
    const params = new URLSearchParams();
    if (filterState.isFilterMode) params.set('filter', '1');
    filterState.genreIds.forEach((id) => params.set('genre', id));
    filterState.countryIds.forEach((id) => params.set('country', id));
    return params.toString();
}

/**
 * Parse filter URL parameters.
 * @param {string} url
 * @returns {Partial<FilterState>}
 */
export function parseFilterUrl(url) {
    if (!url) return {};
    const params = new URLSearchParams(url);
    const result = {};
    if (params.get('filter') === '1') result.isFilterMode = true;
    const genreIds = params.getAll('genre').filter(Boolean);
    const countryIds = params.getAll('country').filter(Boolean);
    if (genreIds.length) result.genreIds = genreIds;
    if (countryIds.length) result.countryIds = countryIds;
    return result;
}

/**
 * Build a combined URL query string for the SearchPage router base.
 * @param {string} urlQuery the `q=` value from the router
 * @param {string} filterUrl filter URL from parseFilterUrl
 * @returns {string}
 */
export function buildCombinedUrlQuery(urlQuery, filterUrl) {
    return `${urlQuery}${filterUrl}`;
}

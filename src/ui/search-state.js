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

//
// In-memory filter-results state for the Search page's filter mode
// (see `pages/SearchPage.jsx` and the `/api/series-filter` endpoint).
//
// Same rationale as `search-state.js`: navigating to the details/player page
// unmounts the search page, but module-level state survives client-side
// navigation, so coming back restores the filtered tiles and the viewport
// position without a new request. A reload intentionally starts fresh — the
// `?m=filter&g=...&c=...` URL parameters are the durable state.
//

/** @import { SerialDescription } from '../parser/search.js' */

/**
 * @typedef {Object} FilterState
 * @property {SerialDescription[]} items
 * @property {string} stats
 * @property {string} genre normalized genre id the results belong to ('all' when unset)
 * @property {string} country normalized country name the results belong to ('all' when unset)
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
 * Decide what the filter mode should show on mount.
 *
 * The URL values win over the stored ones (deep link / reload), while the
 * stored state is only reused when it belongs to the same genre+country pair
 * — coming back from SeriesDetailsPage lands on `/` (no `?g=`/`?c=`), so the
 * stored filter fills the gap and must be reflected in the URL again.
 *
 * @param {string | null | undefined} urlGenre normalized `?g=` value ('' or 'all' when absent)
 * @param {string | null | undefined} urlCountry normalized `?c=` value ('' or 'all' when absent)
 * @param {FilterState | null} stored last filter in this session (or null)
 * @returns {{
 *   genre: string,
 *   country: string,
 *   restored: FilterState | null,
 * }} `genre`/`country` are the effective values to display/filter; `restored`
 *   is the stored state that can be shown as-is without a new request, or
 *   null when a filter request must run.
 */
export function resolveFilterRestore(urlGenre, urlCountry, stored) {
    const genre = urlGenre || (stored?.genre ?? 'all');
    const country = urlCountry || (stored?.country ?? 'all');
    const restored = stored && stored.genre === genre && stored.country === country ? stored : null;
    return { genre, country, restored };
}
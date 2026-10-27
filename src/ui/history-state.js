//
// In-memory history-page state (see `pages/HistoryPage.jsx`).
//
// Same rationale as `search-state.js`: navigating to the details/player page
// unmounts the history page, but module-level state survives client-side
// navigation, so coming back restores the tiles and the viewport position
// without re-reading IndexedDB. A reload intentionally starts fresh — the
// `?q=` URL parameter is the durable state.
//

/** @import { HistoryTile } from './watch-progress.js' */

/**
 * @typedef {Object} HistoryState
 * @property {HistoryTile[]} items
 * @property {string} stats
 * @property {string} query normalized query the items belong to
 * @property {{ index: number, offset: number } | null} [anchor] viewport
 *   position: top-most visible item and the scroll offset past its top edge
 *   (see `anchorFor` in `grid-layout.js`) — restored when the user comes back
 */

/** @type {HistoryState | null} */
let state = null;

/**
 * State of the last history listing in this SPA session, or `null` when
 * there is none (fresh session).
 * @returns {HistoryState | null}
 */
export function getStoredHistoryState() {
    return state;
}

/**
 * Remember the last history listing (or clear the slot with `null`).
 * @param {HistoryState | null} next
 */
export function saveHistoryState(next) {
    state = next;
}

/**
 * Drop the in-memory snapshot so the next visit to the history page re-reads
 * IndexedDB. Called whenever a new watch event is recorded — the stored
 * listing would otherwise show stale data when the user comes back (unlike
 * search results, watch history *changes* while the user is away).
 */
export function invalidateHistoryState() {
    state = null;
}

/**
 * Decide what the history page should show on mount.
 *
 * The URL query wins over the stored one (deep link / reload), while the
 * stored state is only reused when it belongs to the same query — coming
 * back from the details/player page lands on `/history` (no `?q=`), so the
 * stored query fills the gap and must be reflected in the URL again.
 *
 * @param {string} urlQuery normalized `?q=` value ('' when absent)
 * @param {HistoryState | null} stored last history listing (or null)
 * @returns {{ query: string, restored: HistoryState | null }} `query` is the
 *   effective query to display/search; `restored` is the stored state that
 *   can be shown as-is without re-reading IndexedDB, or null when a fresh
 *   listing must be loaded.
 */
export function resolveHistoryRestore(urlQuery, stored) {
    const query = urlQuery || (stored?.query ?? '');
    return { query, restored: stored && stored.query === query ? stored : null };
}
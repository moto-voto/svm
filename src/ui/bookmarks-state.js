//
// In-memory bookmarks-page state (see `pages/BookmarksPage.jsx`).
//
// Same rationale as `search-state.js` / `history-state.js`: navigating to the
// details/player page unmounts the bookmarks page, but module-level state
// survives client-side navigation, so coming back restores the tiles and the
// viewport position without re-reading IndexedDB. A reload intentionally
// starts fresh — the `?q=` URL parameter is the durable state.
//

/** @import { BookmarkTile } from './bookmarks.js' */

/**
 * @typedef {Object} BookmarksState
 * @property {BookmarkTile[]} items
 * @property {string} stats
 * @property {string} query normalized query the items belong to
 * @property {{ index: number, offset: number } | null} [anchor] viewport
 *   position: top-most visible item and the scroll offset past its top edge
 *   (see `anchorFor` in `grid-layout.js`) — restored when the user comes back
 */

/** @type {BookmarksState | null} */
let state = null;

/**
 * State of the last bookmarks listing in this SPA session, or `null` when
 * there is none (fresh session).
 * @returns {BookmarksState | null}
 */
export function getStoredBookmarksState() {
    return state;
}

/**
 * Remember the last bookmarks listing (or clear the slot with `null`).
 * @param {BookmarksState | null} next
 */
export function saveBookmarksState(next) {
    state = next;
}

/**
 * Drop the in-memory snapshot so the next visit to the bookmarks page
 * re-reads IndexedDB. Called whenever a bookmark is added or removed on the
 * details page — the stored listing would otherwise show stale data when the
 * user comes back.
 */
export function invalidateBookmarksState() {
    state = null;
}

/**
 * Decide what the bookmarks page should show on mount.
 *
 * The URL query wins over the stored one (deep link / reload), while the
 * stored state is only reused when it belongs to the same query — coming
 * back from the details/player page lands on `/bookmarks` (no `?q=`), so the
 * stored query fills the gap and must be reflected in the URL again.
 *
 * @param {string} urlQuery normalized `?q=` value ('' when absent)
 * @param {BookmarksState | null} stored last bookmarks listing (or null)
 * @returns {{ query: string, restored: BookmarksState | null }} `query` is the
 *   effective query to display/search; `restored` is the stored state that
 *   can be shown as-is without re-reading IndexedDB, or null when a fresh
 *   listing must be loaded.
 */
export function resolveBookmarksRestore(urlQuery, stored) {
    const query = urlQuery || (stored?.query ?? '');
    return { query, restored: stored && stored.query === query ? stored : null };
}
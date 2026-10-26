/**
 * Pure layout math for the virtualized poster grid (`components/VirtualGrid.jsx`).
 * Kept free of DOM/Solid dependencies so it can be unit tested in isolation.
 */

/** Rows rendered above and below the viewport. */
export const BUFFER_ROWS = 2;

/** Poster aspect ratio (~ 2 : 3.1). */
export const ASPECT_RATIO = 2 / 3.1;

/**
 * Responsive breakpoints copied from the original EJS implementation.
 * @param {number} windowWidth
 * @returns {{ minCardWidth: number, gap: number }}
 */
export function cardMetrics(windowWidth) {
    if (windowWidth >= 640) return { minCardWidth: 165, gap: 18 };
    if (windowWidth >= 400) return { minCardWidth: 145, gap: 14 };
    return { minCardWidth: 125, gap: 10 };
}

/**
 * Compute the grid geometry for a given container width and window width.
 * @param {{ total: number, containerWidth: number, windowWidth: number }} input
 */
export function computeLayout({ total, containerWidth, windowWidth }) {
    const width = containerWidth;
    const { minCardWidth, gap } = cardMetrics(windowWidth);
    const columns = Math.max(1, Math.floor((width + gap) / (minCardWidth + gap)));
    const totalGaps = (columns - 1) * gap;
    const cardWidth = columns > 0 ? (width - totalGaps) / columns : 0;
    const cardHeight = cardWidth / ASPECT_RATIO;
    const rowHeight = cardHeight + gap;
    const totalRows = Math.ceil(total / columns);
    const totalHeight = totalRows > 0 ? totalRows * rowHeight - gap : 0;

    return { gap, columns, cardWidth, cardHeight, rowHeight, totalRows, totalHeight, total };
}

/**
 * Indices of the items that should currently be mounted in the DOM.
 * @param {{
 *   layout: ReturnType<typeof computeLayout>,
 *   scrollY: number,
 *   containerTop: number,
 *   windowHeight: number,
 * }} input
 * @returns {number[]}
 */
export function computeVisibleIndices({ layout, scrollY, containerTop, windowHeight }) {
    if (layout.total === 0 || layout.rowHeight === 0) return [];

    const scrolled = Math.max(0, scrollY - containerTop);
    let startRow = Math.floor(scrolled / layout.rowHeight) - BUFFER_ROWS;
    let endRow = Math.ceil((scrolled + windowHeight) / layout.rowHeight) + BUFFER_ROWS;

    startRow = Math.max(0, startRow);
    endRow = Math.min(layout.totalRows - 1, endRow);

    const startIndex = startRow * layout.columns;
    const endIndex = Math.min(layout.total - 1, (endRow + 1) * layout.columns - 1);

    /** @type {number[]} */
    const indices = [];
    for (let i = startIndex; i <= endIndex; i++) indices.push(i);
    return indices;
}

/**
 * Absolute position for a card at the given item index.
 * @param {ReturnType<typeof computeLayout>} layout
 * @param {number} index
 */
export function positionFor(layout, index) {
    const row = Math.floor(index / layout.columns);
    const col = index % layout.columns;
    return {
        width: `${layout.cardWidth}px`,
        height: `${layout.cardHeight}px`,
        transform: `translate3d(${col * (layout.cardWidth + layout.gap)}px, ${row * layout.rowHeight}px, 0)`,
    };
}

/**
 * Y offset (px) of an item's top edge relative to the grid container,
 * or null for an empty dataset / out-of-range index.
 * @param {ReturnType<typeof computeLayout>} layout
 * @param {number} index
 * @returns {number | null}
 */
export function itemTop(layout, index) {
    if (!Number.isInteger(index) || index < 0 || index >= layout.total || layout.rowHeight <= 0) {
        return null;
    }
    return Math.floor(index / layout.columns) * layout.rowHeight;
}

/**
 * @typedef {{
 *   index: number,
 *   offset: number,
 * }} ViewportAnchor
 */

/**
 * Describe the current viewport by its top-most visible item: which item it
 * is and how many pixels of scroll lie past its top edge (`offset` can be
 * negative when the item's top is still below the viewport top, e.g. before
 * the container is reached). Saving/restoring this anchor survives layout
 * changes (e.g. device rotation) better than a raw scroll offset.
 *
 * @param {{
 *   layout: ReturnType<typeof computeLayout>,
 *   visibleIndices: number[],
 *   scrollY: number,
 *   containerTop: number,
 * }} input
 * @returns {ViewportAnchor | null} null when nothing is visible
 */
export function anchorFor({ layout, visibleIndices, scrollY, containerTop }) {
    const index = visibleIndices[0];
    if (index === undefined) return null;
    const top = itemTop(layout, index);
    if (top === null) return null;
    return { index, offset: scrollY - containerTop - top };
}

/**
 * Document-space `scrollY` that puts a saved anchor back into the same
 * viewport position, or null when the anchor cannot be applied (missing or
 * out of range for the current dataset).
 *
 * @param {{
 *   layout: ReturnType<typeof computeLayout>,
 *   anchor: ViewportAnchor | null | undefined,
 *   containerTop: number,
 * }} input
 * @returns {number | null}
 */
export function scrollPositionForAnchor({ layout, anchor, containerTop }) {
    if (!anchor) return null;
    const top = itemTop(layout, anchor.index);
    if (top === null) return null;
    return Math.max(0, containerTop + top + anchor.offset);
}

/**
 * Human-readable stats label for the header badge.
 * @param {number} mounted number of currently mounted nodes
 * @param {number} total total number of items
 */
export function formatGridStats(mounted, total) {
    return total === 0 ? '0 / 0' : `${mounted} visible (${total.toLocaleString()} total)`;
}
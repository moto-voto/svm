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
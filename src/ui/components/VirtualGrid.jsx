import { createSignal, createMemo, createEffect, onMount, onCleanup, For } from 'solid-js';

const BUFFER_ROWS = 2;
const ASPECT_RATIO = 2 / 3.1;

/**
 * Responsive breakpoints copied from the original EJS implementation.
 * @param {number} windowWidth
 */
function cardMetrics(windowWidth) {
    if (windowWidth >= 640) return { minCardWidth: 165, gap: 18 };
    if (windowWidth >= 400) return { minCardWidth: 145, gap: 14 };
    return { minCardWidth: 125, gap: 10 };
}

/**
 * Windowed / virtualized poster grid. Only the DOM nodes near the viewport are
 * mounted, keeping large result sets fast on mobile.
 *
 * @param {{
 *   items: import('../../parser/search.js').SerialDescription[],
 *   onStats?: (stats: string) => void,
 * }} props
 */
export default function VirtualGrid(props) {
    /** @type {HTMLDivElement | undefined} */
    let containerRef;

    const [windowWidth, setWindowWidth] = createSignal(window.innerWidth);
    const [windowHeight, setWindowHeight] = createSignal(window.innerHeight);
    const [scrollY, setScrollY] = createSignal(window.scrollY);
    const [containerWidth, setContainerWidth] = createSignal(0);
    const [containerTop, setContainerTop] = createSignal(0);

    /** Recompute every measurable value (widths, viewport, offsets). */
    const measure = () => {
        setWindowWidth(window.innerWidth);
        setWindowHeight(window.innerHeight);
        setScrollY(window.scrollY);
        if (!containerRef) return;
        setContainerWidth(containerRef.clientWidth || window.innerWidth - 24);
        setContainerTop(containerRef.getBoundingClientRect().top + window.scrollY);
    };

    const layout = createMemo(() => {
        const width = containerWidth();
        const { minCardWidth, gap } = cardMetrics(windowWidth());
        const columns = Math.max(1, Math.floor((width + gap) / (minCardWidth + gap)));
        const totalGaps = (columns - 1) * gap;
        const cardWidth = columns > 0 ? (width - totalGaps) / columns : 0;
        const cardHeight = cardWidth / ASPECT_RATIO;
        const rowHeight = cardHeight + gap;
        const total = props.items.length;
        const totalRows = Math.ceil(total / columns);
        const totalHeight = totalRows > 0 ? totalRows * rowHeight - gap : 0;

        return { gap, columns, cardWidth, cardHeight, rowHeight, totalRows, totalHeight, total };
    });

    /** Indices of the items that should currently be mounted in the DOM. */
    const visibleIndices = createMemo(() => {
        const l = layout();
        if (l.total === 0 || l.rowHeight === 0) return /** @type {number[]} */ ([]);

        const scrolled = Math.max(0, scrollY() - containerTop());
        let startRow = Math.floor(scrolled / l.rowHeight) - BUFFER_ROWS;
        let endRow = Math.ceil((scrolled + windowHeight()) / l.rowHeight) + BUFFER_ROWS;

        startRow = Math.max(0, startRow);
        endRow = Math.min(l.totalRows - 1, endRow);

        const startIndex = startRow * l.columns;
        const endIndex = Math.min(l.total - 1, (endRow + 1) * l.columns - 1);

        /** @type {number[]} */
        const indices = [];
        for (let i = startIndex; i <= endIndex; i++) indices.push(i);
        return indices;
    });

    /** Absolute position for a card at the given item index. */
    const positionFor = (index) => {
        const l = layout();
        const row = Math.floor(index / l.columns);
        const col = index % l.columns;
        return {
            width: `${l.cardWidth}px`,
            height: `${l.cardHeight}px`,
            transform: `translate3d(${col * (l.cardWidth + l.gap)}px, ${row * l.rowHeight}px, 0)`,
        };
    };

    // Keep the header stats in sync with what is actually mounted.
    createEffect(() => {
        const total = props.items.length;
        const mounted = visibleIndices().length;
        props.onStats?.(total === 0 ? '0 / 0' : `${mounted} visible (${total.toLocaleString()} total)`);
    });

    // A new result set should start from the top of the page.
    let skipInitialScroll = true;
    createEffect(() => {
        // Touch the length so this effect re-runs when the dataset changes.
        void props.items.length;
        if (skipInitialScroll) {
            skipInitialScroll = false;
            return;
        }
        window.scrollTo(0, 0);
    });

    onMount(() => {
        measure();

        const handleScroll = () => setScrollY(window.scrollY);
        const handleResize = () => measure();

        window.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', handleResize);

        const resizeObserver = new ResizeObserver(() => measure());
        if (containerRef) resizeObserver.observe(containerRef);

        onCleanup(() => {
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('orientationchange', handleResize);
            resizeObserver.disconnect();
        });
    });

    return (
        <div
            ref={containerRef}
            class="relative w-full"
            style={{ height: `${layout().totalHeight}px` }}
        >
            <For each={visibleIndices()}>
                {(index) => {
                    const item = () => props.items[index];
                    return (
                        <a
                            href={`/series?url=${encodeURIComponent(item().fullLink)}`}
                            rel="noopener noreferrer"
                            class="poster-card"
                            style={positionFor(index)}
                        >
                            <div
                                class="poster-bg"
                                style={{ 'background-image': `url('${item().image ?? ''}')` }}
                            />
                            <div class="card-overlay">
                                <h2 class="text-xs sm:text-sm font-bold text-white leading-snug text-shadow-sm line-clamp-2">
                                    {item().title}
                                </h2>
                            </div>
                        </a>
                    );
                }}
            </For>
        </div>
    );
}

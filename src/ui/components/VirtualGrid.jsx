import { createSignal, createMemo, createEffect, onMount, onCleanup, For } from 'solid-js';
import { A } from '@solidjs/router';
import { computeLayout, computeVisibleIndices, positionFor, formatGridStats, anchorFor, scrollPositionForAnchor } from '../grid-layout.js';

/** @import { SerialDescription } from '../../parser/search.js' */

/**
 * Windowed / virtualized poster grid. Only the DOM nodes near the viewport are
 * mounted, keeping large result sets fast on mobile.
 *
 * @param {{
 *   items: SerialDescription[],
 *   onStats?: (stats: string) => void,
 *   onViewportChange?: (anchor: { index: number, offset: number }) => void,
 *   restoreAnchor?: { index: number, offset: number } | null,
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

    const layout = createMemo(() =>
        computeLayout({
            total: props.items.length,
            containerWidth: containerWidth(),
            windowWidth: windowWidth(),
        })
    );

    /** Indices of the items that should currently be mounted in the DOM. */
    const visibleIndices = createMemo(() =>
        computeVisibleIndices({
            layout: layout(),
            scrollY: scrollY(),
            containerTop: containerTop(),
            windowHeight: windowHeight(),
        })
    );

    /** Absolute position for a card at the given item index. */
    const position = (/** @type {number} */ index) => positionFor(layout(), index);

    // Keep the header stats in sync with what is actually mounted.
    createEffect(() => {
        props.onStats?.(formatGridStats(visibleIndices().length, props.items.length));
    });

    // Report the viewport anchor (top-most visible item + scroll offset past
    // it) so the parent can restore the scroll position when the user comes
    // back from another page.
    createEffect(() => {
        const anchor = anchorFor({
            layout: layout(),
            visibleIndices: visibleIndices(),
            scrollY: scrollY(),
            containerTop: containerTop(),
        });
        if (anchor) {
            props.onViewportChange?.(anchor);
        }
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

        // Put the saved viewport anchor back under the viewport top (coming
        // back to the grid from another page must not land at the top). Read
        // once: the anchor to restore is fixed for this mount.
        //
        // The container's height style is bound to `layout()`, but at this
        // point it was rendered from the unmeasured containerWidth (0), i.e.
        // far too short, and the style effect updating it has not flushed
        // yet. Apply the measured height directly — otherwise the document is
        // not scrollable far enough and the browser clamps `scrollTo` back to
        // the top of the list. The queued style effect writes the same value.
        if (containerRef) {
            containerRef.style.height = `${layout().totalHeight}px`;
        }
        const restoredY = scrollPositionForAnchor({
            layout: layout(),
            anchor: props.restoreAnchor,
            containerTop: containerTop(),
        });
        if (restoredY !== null) {
            window.scrollTo(0, restoredY);
        }

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
                        <A
                            href={`/series-details?url=${encodeURIComponent(item().fullLink)}`}
                            class="poster-card"
                            style={position(index)}
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
                        </A>
                    );
                }}
            </For>
        </div>
    );
}

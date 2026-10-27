import { createSignal, onMount, onCleanup, Show } from 'solid-js';
import { useSearchParams, A } from '@solidjs/router';
import Header from '../components/Header.jsx';
import VirtualGrid from '../components/VirtualGrid.jsx';
import { normalizeQuery } from '../utils.js';
import { loadWatchHistory, buildHistoryTiles, padBadgeNumber } from '../watch-progress.js';
import { getStoredHistoryState, saveHistoryState, resolveHistoryRestore } from '../history-state.js';

/**
 * The subset of a history tile the corner badges need (the grid's items are
 * structurally compatible).
 * @typedef {Object} HistoryBadgeItem
 * @property {number | null | undefined} [seasonNumber]
 * @property {number | null | undefined} [episodeNumber]
 */

/**
 * Corner badge for a 1-based season number ("S01"), or null when the record
 * has no usable number.
 * @param {HistoryBadgeItem} item
 */
const seasonBadge = (item) => {
    const padded = padBadgeNumber(item.seasonNumber);
    return padded ? `S${padded}` : null;
};

/**
 * Corner badge for a 1-based episode number ("E05"), or null when the record
 * has no usable number.
 * @param {HistoryBadgeItem} item
 */
const episodeBadge = (item) => {
    const padded = padBadgeNumber(item.episodeNumber);
    return padded ? `E${padded}` : null;
};

export default function HistoryPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const urlQuery = normalizeQuery(Array.isArray(searchParams.q) ? searchParams.q[0] : searchParams.q || '');

    // Restore the previous listing from the in-memory store (survives
    // navigating to the details/player page and back, but not a reload — the
    // `?q=` URL parameter is the durable state). The URL query wins over the
    // stored one, mirroring the search page.
    const stored = getStoredHistoryState();
    const { query: effectiveQuery, restored: restoredState } = resolveHistoryRestore(urlQuery, stored);

    const [items, setItems] = createSignal(restoredState ? restoredState.items : []);
    const [loading, setLoading] = createSignal(!restoredState);
    const [error, setError] = createSignal(/** @type {string | null} */ (null));
    const [stats, setStats] = createSignal(restoredState ? restoredState.stats : '0 / 0');
    // Whether *any* series has been watched (distinguishes "history is empty"
    // from "no search match").
    const [hasHistory, setHasHistory] = createSignal(true);

    const [query, setQuery] = createSignal(effectiveQuery);
    const [activeQuery, setActiveQuery] = createSignal(effectiveQuery);

    // Viewport anchor for back-navigation restore (same protocol as the
    // search page — see `anchorFor` in grid-layout.js).
    let latestAnchor = restoredState?.anchor ?? null;

    /** Persist the current listing and viewport position. */
    const persist = () => {
        if (!items().length) return;
        saveHistoryState({ items: items(), stats: stats(), query: activeQuery(), anchor: latestAnchor });
    };

    /** @param {SubmitEvent} event */
    const handleSubmit = (event) => {
        event.preventDefault();
        const q = normalizeQuery(query());
        setQuery(q);
        load(q);
    };

    /**
     * Load the watch history from IndexedDB and filter it for the query.
     * @param {string} q
     */
    const load = async (q) => {
        setLoading(true);
        setError(null);
        setActiveQuery(q);
        latestAnchor = null; // a new listing starts at the top

        // Keep the URL shareable/bookmarkable.
        setSearchParams({ q: q || undefined }, { replace: true });

        try {
            const records = await loadWatchHistory();
            setHasHistory(records.length > 0);
            const tiles = buildHistoryTiles(records, q);
            setItems(tiles);
            saveHistoryState({ items: tiles, stats: stats(), query: q, anchor: null });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error: ' + String(err));
            setItems([]);
        } finally {
            setLoading(false);
        }
    };

    onMount(() => {
        // Reflect the effective query in the address bar even when the tiles
        // were restored from the in-memory store (e.g. back navigation from
        // the details page lands on `/history` without `?q=`).
        setSearchParams({ q: effectiveQuery || undefined }, { replace: true });
        if (!restoredState) {
            load(effectiveQuery);
        }
    });

    onCleanup(() => {
        // Remember where the user was in the grid so coming back restores the
        // exact viewport position.
        persist();
    });

    return (
        <div class="min-h-screen flex flex-col bg-[#0d0d0d] text-neutral-200">
            <Header
                maxWidth="max-w-7xl"
                topRight={
                    <div class="flex items-center gap-2">
                        <A
                            href="/"
                            noScroll
                            title="Вернуться к поиску сериалов"
                            class="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-[#222226] hover:bg-[#2c2c32] hover:text-brand-orange text-gray-300 border border-neutral-700/60 transition-colors whitespace-nowrap"
                        >
                            <i class="fa-solid fa-magnifying-glass text-brand-orange"></i>
                            <span class="hidden sm:inline">К поиску</span>
                        </A>
                        <Show when={stats()}>
                            <span class="text-xs bg-brand-orange/15 text-brand-orange font-semibold px-2.5 py-1 rounded-full whitespace-nowrap">
                                {stats()}
                            </span>
                        </Show>
                    </div>
                }
            >
                <form
                    class="w-full flex items-center shadow-inner rounded overflow-hidden bg-[#2d2d2d] border border-neutral-700/60 focus-within:border-brand-orange transition-colors"
                    onSubmit={handleSubmit}
                >
                    <input
                        type="text"
                        placeholder="Поиск в истории..."
                        value={query()}
                        disabled={loading()}
                        onInput={(event) => setQuery(event.currentTarget.value)}
                        class="w-full px-3 py-1.5 text-sm bg-transparent text-neutral-100 placeholder-neutral-400 focus:outline-none disabled:opacity-60"
                    />
                    <button
                        type="submit"
                        disabled={loading()}
                        class="bg-brand-orange hover:bg-brand-orangeDark active:bg-brand-orangeDark text-black font-bold text-sm px-4 py-1.5 transition-colors shrink-0 flex items-center justify-center disabled:opacity-60"
                    >
                        Go
                    </button>
                </form>
            </Header>

            <main class="max-w-7xl mx-auto p-3 sm:p-5 flex-1 w-full relative">
                {/* Loading Spinner Overlay */}
                <Show when={loading()}>
                    <div class="absolute inset-0 z-20 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-start pt-24 transition-opacity duration-200">
                        <div class="spinner mb-3" />
                        <p class="text-sm font-medium text-[#ff9800]">Загрузка истории...</p>
                    </div>
                </Show>

                {/* Error alert */}
                <Show when={!loading() && error()}>
                    <div class="py-20 text-center text-red-400 font-medium">{error()}</div>
                </Show>

                {/* Empty history alert */}
                <Show when={!loading() && !error() && !hasHistory()}>
                    <div class="py-20 text-center">
                        <i class="fa-solid fa-clock-rotate-left text-4xl text-neutral-600 mb-4"></i>
                        <p class="text-neutral-400 font-medium">История просмотра пуста</p>
                        <p class="text-neutral-500 text-sm mt-1">
                            Начните смотреть сериалы, и они появятся здесь.
                        </p>
                        <A
                            href="/"
                            class="inline-flex items-center gap-2 mt-5 text-sm font-semibold text-brand-orange hover:underline"
                        >
                            <i class="fa-solid fa-magnifying-glass text-xs"></i>
                            Вернуться к поиску
                        </A>
                    </div>
                </Show>

                {/* No search match within history */}
                <Show when={!loading() && !error() && hasHistory() && items().length === 0}>
                    <div class="py-20 text-center text-neutral-400 font-medium">
                        Ничего не найдено в истории
                    </div>
                </Show>

                {/* Virtual Canvas Container (grows to full dataset height) */}
                <VirtualGrid
                    items={items()}
                    restoreAnchor={restoredState?.anchor ?? null}
                    detailsFrom="history"
                    topLeftBadge={seasonBadge}
                    topRightBadge={episodeBadge}
                    onViewportChange={(anchor) => { latestAnchor = anchor; }}
                    onStats={(newStats) => {
                        setStats(newStats);
                        // Only persist settled, successful listings; while a load
                        // is in flight (or failed) the stored state must keep
                        // belonging to the previous query.
                        if (!loading() && !error()) {
                            persist();
                        }
                    }}
                />
            </main>
        </div>
    );
}
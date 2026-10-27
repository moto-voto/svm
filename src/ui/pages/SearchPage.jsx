import { createSignal, onMount, onCleanup, Show } from 'solid-js';
import { useSearchParams } from '@solidjs/router';
import Header from '../components/Header.jsx';
import VirtualGrid from '../components/VirtualGrid.jsx';
import FilterHeader from '../components/FilterHeader.jsx';
import FilterPanel from '../components/FilterPanel.jsx';
import { searchSeries } from '../api.js';
import { normalizeQuery } from '../utils.js';
import { getStoredSearchState, saveSearchState, resolveSearchRestore, getFilterState, setFilterState, clearFilters, buildFilterUrl, buildCombinedUrlQuery } from '../search-state.js';

export default function SearchPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const urlQuery = normalizeQuery(Array.isArray(searchParams.q) ? searchParams.q[0] : searchParams.q || '');

    // Parse filter URL parameters
    const filterValue = searchParams.filter || '';
    const genreValues = searchParams.genre;
    const countryValues = searchParams.country;

    const stored = getStoredSearchState();
    const { query: effectiveQuery, restored: restoredState } = resolveSearchRestore(urlQuery, stored);

    // Build combined URL query: q=... followed by filter parameters
    const filterUrl = new URLSearchParams(
        Array.from({ length: genreValues.length + countryValues.length + (filterValue ? 1 : 0) }, () => '')
            .map((_, idx) => {
                if (filterValue && idx === 0) return `filter=1`;
                if (genreValues[idx]) return `genre=${genreValues[idx]}`;
                if (countryValues[idx]) return `country=${countryValues[idx]}`;
                return '';
            })
            .filter(Boolean)
            .join('&')
    ).toString();

    const combinedUrlQuery = buildCombinedUrlQuery(urlQuery, filterUrl);

    const [items, setItems] = createSignal(restoredState ? restoredState.items : []);
    const [loading, setLoading] = createSignal(!restoredState);
    const [error, setError] = createSignal(/** @type {string | null} */ (null));
    const [stats, setStats] = createSignal(restoredState ? restoredState.stats : '0 / 0');

    // `query` is the search input value; `activeQuery` is the query the
    // currently displayed results belong to (they diverge while the user
    // types a new search). Both start from the effective query.
    const [query, setQuery] = createSignal(effectiveQuery);
    const [activeQuery, setActiveQuery] = createSignal(effectiveQuery);

    // Where the user is in the grid (top-most visible item + offset, see
    // `anchorFor` in grid-layout.js). Kept in a plain variable by VirtualGrid
    // callbacks — never rendered, so no reactivity is needed. Starts from the
    // restored anchor so leaving again right away keeps the position.
    let latestAnchor = restoredState?.anchor ?? null;

    /** Persist the current search results and viewport position. */
    const persist = () => {
        if (!items().length) return;
        saveSearchState({ items: items(), stats: stats(), query: activeQuery(), anchor: latestAnchor });
    };

    /** @param {SubmitEvent} event */
    const handleSubmit = (event) => {
        event.preventDefault();
        const q = normalizeQuery(query());
        setQuery(q);
        load(q, false);
    };

    /**
     * Load results for a query from the backend and keep the URL shareable.
     * @param {string} q
     * @param {boolean} resetAnchor - reset anchor to top of results
     */
    const load = async (q, resetAnchor = true) => {
        setLoading(true);
        setError(null);
        setActiveQuery(q);
        latestAnchor = resetAnchor ? null : latestAnchor;

        // Keep the URL shareable/bookmarkable.
        setSearchParams({ q: q || undefined }, { replace: true });

        try {
            const results = await searchSeries(q);
            setItems(results);
            saveSearchState({ items: results, stats: stats(), query: q, anchor: resetAnchor ? null : latestAnchor });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error: ' + String(err));
            setItems([]);
            // Keep the previous stored state: it belongs to another query, so
            // a later visit will mismatch and refetch instead of showing junk.
        } finally {
            setLoading(false);
        }
    };

    /**
     * Trigger a new search with current query and filters.
     * Preserves viewport anchor if filters haven't changed.
     */
    const triggerSearch = () => {
        load(activeQuery(), !filterUrl); // reset anchor only if filters changed
    };

    onMount(() => {
        // Reflect the effective query in the address bar even when the
        // results were restored from the in-memory store (e.g. back navigation
        // from SeriesDetailsPage lands on `/` without `?q=`).
        setSearchParams({ q: effectiveQuery || undefined }, { replace: true });
        if (!restoredState) {
            load(effectiveQuery);
        }
    });

    onCleanup(() => {
        // Remember where the user was in the grid so coming back from the
        // details/player page restores the exact viewport position.
        persist();
    });

    return (
        <div class="min-h-screen flex flex-col bg-[#0d0d0d] text-neutral-200">
            <Header
                maxWidth="max-w-7xl"
                topRight={
                    <Show when={stats()}>
                        <span class="text-xs bg-brand-orange/15 text-brand-orange font-semibold px-2.5 py-1 rounded-full whitespace-nowrap">
                            {stats()}
                        </span>
                    </Show>
                }
            >
                <FilterHeader onSearch={triggerSearch} />
                <form
                    class="w-full flex items-center shadow-inner rounded overflow-hidden bg-[#2d2d2d] border border-neutral-700/60 focus-within:border-brand-orange transition-colors"
                    onSubmit={handleSubmit}
                >
                    <input
                        type="text"
                        placeholder="Поиск сериала..."
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
                        <p class="text-sm font-medium text-[#ff9800]">Загрузка результатов...</p>
                    </div>
                </Show>

                {/* Error alert */}
                <Show when={!loading() && error()}>
                    <div class="py-20 text-center text-red-400 font-medium">{error()}</div>
                </Show>

                {/* Empty search result alert */}
                <Show when={!loading() && !error() && items().length === 0}>
                    <div class="py-20 text-center text-neutral-400 font-medium">Ничего не найдено</div>
                </Show>

                {/* Virtual Canvas Container (grows to full dataset height) */}
                <VirtualGrid
                    items={items()}
                    restoreAnchor={restoredState?.anchor ?? null}
                    onViewportChange={(anchor) => { latestAnchor = anchor; }}
                    onStats={(newStats) => {
                        setStats(newStats);
                        // Only persist settled, successful results; while a load
                        // is in flight (or failed) the stored state must keep
                        // belonging to the previous query so a later visit
                        // refetches instead of restoring junk.
                        if (!loading() && !error()) {
                            persist();
                        }
                    }}
                />
            </main>

            {/* Filter Panel Modal */}
            <Show when={filterValue === '1'}>
                <FilterPanel
                    open={true}
                    onClose={() => setSearchParams({ filter: undefined, genre: [], country: [] }, { replace: true })}
                    activeFilters={{
                        genre: genreValues,
                        country: countryValues
                    }}
                    onApply={() => {
                        triggerSearch();
                        setSearchParams({ filter: undefined, genre: [], country: [] }, { replace: true });
                    }}
                />
            </Show>
        </div>
    );
}

import { createSignal, onMount, onCleanup, Show, For } from 'solid-js';
import { useSearchParams } from '@solidjs/router';
import Header from '../components/Header.jsx';
import ViewSwitcher from '../components/ViewSwitcher.jsx';
import VirtualGrid from '../components/VirtualGrid.jsx';
import { searchSeries, filterSeries } from '../api.js';
import { normalizeQuery } from '../utils.js';
import { getStoredSearchState, saveSearchState, resolveSearchRestore } from '../search-state.js';
import { getStoredFilterState, saveFilterState, resolveFilterRestore } from '../filter-state.js';
import { GENRES, COUNTRIES, ALL_VALUE, normalizeFilterValue } from '../filter-options.js';

/** @import { SerialDescription } from '../../parser/search.js' */

export default function SearchPage() {
    const [searchParams, setSearchParams] = useSearchParams();

    /** @param {string} name @returns {string | undefined} */
    const rawParam = (name) => {
        const value = searchParams[name];
        return Array.isArray(value) ? value[0] : value;
    };

    const urlQuery = normalizeQuery(rawParam('q') || '');
    const urlGenre = normalizeFilterValue(rawParam('g'));
    const urlCountry = normalizeFilterValue(rawParam('c'));
    // `?m=filter` marks the filter mode (its absence means search). Keeping
    // the mode explicit in the URL means a shareable link stays in it even
    // when both filter dimensions are "all" (whole-catalog browsing).
    const initialMode = rawParam('m') === 'filter' ? 'filter' : 'search';

    // Restore the previous listing of each mode from its own in-memory store
    // (survives navigating to SeriesDetailsPage and back, but not a reload —
    // the URL is the durable state). URL values win over stored ones.
    const storedSearch = getStoredSearchState();
    const storedFilter = getStoredFilterState();
    const searchRestore = resolveSearchRestore(urlQuery, storedSearch);
    const filterRestore = resolveFilterRestore(urlGenre, urlCountry, storedFilter);
    const initialRestore = initialMode === 'search' ? searchRestore : filterRestore;
    const restoredState = initialRestore.restored;

    const [mode, setMode] = createSignal(initialMode);
    const [items, setItems] = createSignal(restoredState ? restoredState.items : []);
    const [loading, setLoading] = createSignal(!restoredState);
    const [error, setError] = createSignal(/** @type {string | null} */ (null));
    const [stats, setStats] = createSignal(restoredState ? restoredState.stats : '0 / 0');

    // Search mode: `query` is the input value, `activeQuery` the applied one
    // (they diverge while the user types a new search).
    const [query, setQuery] = createSignal(initialMode === 'search' ? searchRestore.query : '');
    const [activeQuery, setActiveQuery] = createSignal(initialMode === 'search' ? searchRestore.query : '');

    // Filter mode: `genre`/`country` are the select values, `activeGenre`/
    // `activeCountry` the applied ones (they stay in sync — the filter
    // applies immediately on change).
    const [genre, setGenre] = createSignal(initialMode === 'filter' ? filterRestore.genre : ALL_VALUE);
    const [activeGenre, setActiveGenre] = createSignal(initialMode === 'filter' ? filterRestore.genre : ALL_VALUE);
    const [country, setCountry] = createSignal(initialMode === 'filter' ? filterRestore.country : ALL_VALUE);
    const [activeCountry, setActiveCountry] = createSignal(initialMode === 'filter' ? filterRestore.country : ALL_VALUE);

    // Where the user is in the grid (top-most visible item + offset, see
    // `anchorFor` in grid-layout.js). Kept in a plain variable by VirtualGrid
    // callbacks — never rendered, so no reactivity is needed.
    let latestAnchor = restoredState?.anchor ?? null;

    /** Persist the current listing (in its own mode store) and viewport. */
    const persist = () => {
        if (!items().length) return;
        if (mode() === 'search') {
            saveSearchState({ items: items(), stats: stats(), query: activeQuery(), anchor: latestAnchor });
        } else {
            saveFilterState({
                items: items(),
                stats: stats(),
                genre: activeGenre(),
                country: activeCountry(),
                anchor: latestAnchor,
            });
        }
    };

    /** @param {SubmitEvent} event */
    const handleSubmit = (event) => {
        event.preventDefault();
        const q = normalizeQuery(query());
        setQuery(q);
        load({ kind: 'search', q });
    };

    /**
     * Load a listing for a mode from the backend and keep the URL shareable.
     * `activeQuery`/`activeGenre`/`activeCountry` become the applied values.
     * @param {{ kind: 'search', q: string } | { kind: 'filter', g: string, c: string }} next
     */
    const load = async (next) => {
        setLoading(true);
        setError(null);
        latestAnchor = null; // a new result set starts at the top

        setMode(next.kind);
        if (next.kind === 'search') {
            setActiveQuery(next.q);
            setSearchParams({ m: undefined, q: next.q || undefined }, { replace: true });
        } else {
            setActiveGenre(next.g);
            setActiveCountry(next.c);
            setSearchParams(
                {
                    m: 'filter',
                    q: undefined,
                    g: next.g === ALL_VALUE ? undefined : next.g,
                    c: next.c === ALL_VALUE ? undefined : next.c,
                },
                { replace: true }
            );
        }

        try {
            const results = next.kind === 'search' ? await searchSeries(next.q) : await filterSeries(next.g, next.c);
            setItems(results);
            if (next.kind === 'search') {
                saveSearchState({ items: results, stats: stats(), query: next.q, anchor: null });
            } else {
                saveFilterState({ items: results, stats: stats(), genre: next.g, country: next.c, anchor: null });
            }
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
     * Switch between search and filter modes. The destination mode restores
     * the in-memory listing of this session when it has one, otherwise it
     * starts fresh (new dataset at the top).
     * @param {'search' | 'filter'} next
     */
    const switchMode = (next) => {
        if (next === mode() || loading()) return;
        persist(); // remember where the currently active view was
        setMode(next);
        latestAnchor = null;
        if (next === 'search') {
            const stored = getStoredSearchState();
            if (stored) {
                setItems(stored.items);
                setStats(stored.stats);
                setQuery(stored.query);
                setActiveQuery(stored.query);
                setSearchParams({ m: undefined, q: stored.query || undefined }, { replace: true });
            } else {
                load({ kind: 'search', q: query() || '' });
            }
        } else {
            const stored = getStoredFilterState();
            const g = stored?.genre ?? ALL_VALUE;
            const c = stored?.country ?? ALL_VALUE;
            if (stored) {
                setItems(stored.items);
                setStats(stored.stats);
                setGenre(g);
                setActiveGenre(g);
                setCountry(c);
                setActiveCountry(c);
                setSearchParams(
                    { m: 'filter', q: undefined, g: g === ALL_VALUE ? undefined : g, c: c === ALL_VALUE ? undefined : c },
                    { replace: true }
                );
            } else {
                load({ kind: 'filter', g, c });
            }
        }
    };

    onMount(() => {
        // Reflect the effective query/filter in the address bar even when the
        // results were restored from an in-memory store (e.g. back navigation
        // from SeriesDetailsPage lands on `/` without `?q=`/`?g=`).
        if (mode() === 'search') {
            setSearchParams({ q: activeQuery() || undefined }, { replace: true });
        } else {
            setSearchParams(
                {
                    m: 'filter',
                    q: undefined,
                    g: activeGenre() === ALL_VALUE ? undefined : activeGenre(),
                    c: activeCountry() === ALL_VALUE ? undefined : activeCountry(),
                },
                { replace: true }
            );
        }
        if (!restoredState) {
            load(
                mode() === 'search'
                    ? { kind: 'search', q: activeQuery() }
                    : { kind: 'filter', g: activeGenre(), c: activeCountry() }
            );
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
                nav={<ViewSwitcher current="search" />}
                topRight={
                    <Show when={stats()}>
                        <span class="text-xs bg-brand-orange/15 text-brand-orange font-semibold px-2.5 py-1 rounded-full whitespace-nowrap">
                            {stats()}
                        </span>
                    </Show>
                }
            >
                <div class="w-full flex flex-col gap-2">
                    {/* Search vs Filter mode toggle (finger-friendly target) */}
                    <div class="grid grid-cols-2 gap-0.5 p-0.5 rounded-lg border border-neutral-700/60 bg-[#19191c]">
                        <button
                            type="button"
                            disabled={loading()}
                            onClick={() => switchMode('search')}
                            class="inline-flex items-center justify-center gap-2 py-2 rounded-md text-sm font-semibold transition-colors disabled:opacity-60"
                            classList={{
                                'bg-brand-orange text-black': mode() === 'search',
                                'text-gray-300 hover:bg-[#2b2b31] hover:text-white': mode() !== 'search',
                            }}
                        >
                            <i class="fa-solid fa-magnifying-glass text-sm"></i>
                            <span>Поиск</span>
                        </button>
                        <button
                            type="button"
                            disabled={loading()}
                            onClick={() => switchMode('filter')}
                            class="inline-flex items-center justify-center gap-2 py-2 rounded-md text-sm font-semibold transition-colors disabled:opacity-60"
                            classList={{
                                'bg-brand-orange text-black': mode() === 'filter',
                                'text-gray-300 hover:bg-[#2b2b31] hover:text-white': mode() !== 'filter',
                            }}
                        >
                            <i class="fa-solid fa-sliders text-sm"></i>
                            <span>Фильтр</span>
                        </button>
                    </div>

                    <Show
                        when={mode() === 'search'}
                        fallback={
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <label class="flex items-center gap-2 bg-[#2d2d2d] border border-neutral-700/60 rounded overflow-hidden focus-within:border-brand-orange transition-colors">
                                    <i class="fa-solid fa-tags text-xs text-brand-orange pl-3 shrink-0"></i>
                                    <select
                                        value={genre()}
                                        disabled={loading()}
                                        onChange={(event) => {
                                            const g = event.currentTarget.value;
                                            setGenre(g);
                                            load({ kind: 'filter', g, c: country() });
                                        }}
                                        class="w-full py-2.5 pr-3 text-sm bg-transparent text-neutral-100 focus:outline-none disabled:opacity-60"
                                    >
                                        <For each={GENRES}>
                                            {(option) => <option value={option.value}>{option.label}</option>}
                                        </For>
                                    </select>
                                </label>
                                <label class="flex items-center gap-2 bg-[#2d2d2d] border border-neutral-700/60 rounded overflow-hidden focus-within:border-brand-orange transition-colors">
                                    <i class="fa-solid fa-earth-europe text-xs text-brand-orange pl-3 shrink-0"></i>
                                    <select
                                        value={country()}
                                        disabled={loading()}
                                        onChange={(event) => {
                                            const c = event.currentTarget.value;
                                            setCountry(c);
                                            load({ kind: 'filter', g: genre(), c });
                                        }}
                                        class="w-full py-2.5 pr-3 text-sm bg-transparent text-neutral-100 focus:outline-none disabled:opacity-60"
                                    >
                                        <For each={COUNTRIES}>
                                            {(option) => <option value={option.value}>{option.label}</option>}
                                        </For>
                                    </select>
                                </label>
                            </div>
                        }
                    >
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
                    </Show>
                </div>
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

                {/* Empty result alert (per mode) */}
                <Show when={!loading() && !error() && items().length === 0}>
                    <div class="py-20 text-center text-neutral-400 font-medium">
                        {mode() === 'filter' ? 'По выбранным фильтрам ничего не найдено' : 'Ничего не найдено'}
                    </div>
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
        </div>
    );
}
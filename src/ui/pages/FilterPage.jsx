import { createSignal, onMount, onCleanup, Show, For } from 'solid-js';
import { useSearchParams } from '@solidjs/router';
import Header from '../components/Header.jsx';
import ViewSwitcher from '../components/ViewSwitcher.jsx';
import VirtualGrid from '../components/VirtualGrid.jsx';
import { filterSeries } from '../api.js';
import { getStoredFilterState, saveFilterState, resolveFilterRestore } from '../filter-state.js';
import { GENRES, COUNTRIES, ALL_VALUE } from '../filter-options.js';

/**
 * Genre/country filter view (`/filter`): the same virtualized poster grid as
 * the search page, but fed by `/api/series-filter`. The genre and country
 * dropdowns apply immediately on change; results are sorted/displayed by the
 * backend and carry no cover art (the grid renders a fallback tile).
 */
export default function FilterPage() {
    const [searchParams, setSearchParams] = useSearchParams();

    /** @param {string} name @returns {string | undefined} */
    const rawParam = (name) => {
        const value = searchParams[name];
        return Array.isArray(value) ? value[0] : value;
    };

    // A URL with `?g=`/`?c=` wins (deep link / reload); a bare `/filter` URL
    // reuses the last filter applied in this session (see resolveFilterRestore).
    const stored = getStoredFilterState();
    const { genre: effectiveGenre, country: effectiveCountry, restored: restoredState } = resolveFilterRestore(
        rawParam('g'),
        rawParam('c'),
        stored
    );

    const [items, setItems] = createSignal(restoredState ? restoredState.items : []);
    const [loading, setLoading] = createSignal(!restoredState);
    const [error, setError] = createSignal(/** @type {string | null} */ (null));
    const [stats, setStats] = createSignal(restoredState ? restoredState.stats : '0 / 0');

    // `genre`/`country` are the select values; they are also the applied ones
    // — the filter fires immediately on change.
    const [genre, setGenre] = createSignal(effectiveGenre);
    const [country, setCountry] = createSignal(effectiveCountry);

    // Where the user is in the grid (top-most visible item + offset, see
    // `anchorFor` in grid-layout.js). Kept in a plain variable by VirtualGrid
    // callbacks — never rendered, so no reactivity is needed.
    let latestAnchor = restoredState?.anchor ?? null;

    /** Persist the current results and viewport position. */
    const persist = () => {
        if (!items().length) return;
        saveFilterState({ items: items(), stats: stats(), genre: genre(), country: country(), anchor: latestAnchor });
    };

    /**
     * Apply a filter (genre id / country name, `'all'` = unconstrained) and
     * keep the URL shareable.
     * @param {string} g
     * @param {string} c
     */
    const load = async (g, c) => {
        setLoading(true);
        setError(null);
        latestAnchor = null; // a new result set starts at the top

        setGenre(g);
        setCountry(c);
        setSearchParams(
            { g: g === ALL_VALUE ? undefined : g, c: c === ALL_VALUE ? undefined : c },
            { replace: true }
        );

        try {
            const results = await filterSeries(g, c);
            setItems(results);
            saveFilterState({ items: results, stats: stats(), genre: g, country: c, anchor: null });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error: ' + String(err));
            setItems([]);
            // Keep the previous stored state: it belongs to another filter, so
            // a later visit will mismatch and refetch instead of showing junk.
        } finally {
            setLoading(false);
        }
    };

    onMount(() => {
        // Reflect the effective filter in the address bar even when the results
        // were restored from the in-memory store.
        setSearchParams(
            {
                g: genre() === ALL_VALUE ? undefined : genre(),
                c: country() === ALL_VALUE ? undefined : country(),
            },
            { replace: true }
        );
        if (!restoredState) {
            load(effectiveGenre, effectiveCountry);
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
                nav={<ViewSwitcher current="filter" />}
                topRight={
                    <Show when={stats()}>
                        <span class="text-xs bg-brand-orange/15 text-brand-orange font-semibold px-2.5 py-1 rounded-full whitespace-nowrap">
                            {stats()}
                        </span>
                    </Show>
                }
            >
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label class="flex items-center gap-2 bg-[#2d2d2d] border border-neutral-700/60 rounded overflow-hidden focus-within:border-brand-orange transition-colors">
                        <i class="fa-solid fa-tags text-xs text-brand-orange pl-3 shrink-0"></i>
                        <select
                            value={genre()}
                            disabled={loading()}
                            onChange={(event) => {
                                const g = event.currentTarget.value;
                                load(g, country());
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
                                load(genre(), c);
                            }}
                            class="w-full py-2.5 pr-3 text-sm bg-transparent text-neutral-100 focus:outline-none disabled:opacity-60"
                        >
                            <For each={COUNTRIES}>
                                {(option) => <option value={option.value}>{option.label}</option>}
                            </For>
                        </select>
                    </label>
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

                {/* Empty result alert */}
                <Show when={!loading() && !error() && items().length === 0}>
                    <div class="py-20 text-center text-neutral-400 font-medium">
                        По выбранным фильтрам ничего не найдено
                    </div>
                </Show>

                {/* Virtual Canvas Container (grows to full dataset height) */}
                <VirtualGrid
                    items={items()}
                    restoreAnchor={restoredState?.anchor ?? null}
                    detailsFrom="filter"
                    onViewportChange={(anchor) => { latestAnchor = anchor; }}
                    onStats={(newStats) => {
                        setStats(newStats);
                        // Only persist settled, successful results; while a load
                        // is in flight (or failed) the stored state must keep
                        // belonging to the previous filter.
                        if (!loading() && !error()) {
                            persist();
                        }
                    }}
                />
            </main>
        </div>
    );
}
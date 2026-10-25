import { createSignal, createEffect, onMount, Show } from 'solid-js';
import { useSearchParams, A } from '@solidjs/router';
import Header from '../components/Header.jsx';
import VirtualGrid from '../components/VirtualGrid.jsx';
import { searchSeries } from '../api.js';
import { normalizeQuery } from '../utils.js';

/** @import { SerialDescription } from '../../parser/search.js' */

/** 
 * @typedef {Object} SearchState
 * @property {SerialDescription[]} items
 * @property {string} stats
 * @property {string} query
 * @property {boolean} loading
 * @property {number} timestamp
 */

const STORAGE_KEY = 'svm_search_state';
const MAX_AGE = 10 * 60 * 1000; // 10 minutes

/**
 * 
 * @returns { SearchState | null }
 */
function getStoredState() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return null;
        const data = JSON.parse(stored);
        if (Date.now() - data.timestamp > MAX_AGE) return null;
        return data;
    } catch {
        return null;
    }
}

/**
 * @param {SerialDescription[]} items
 * @param {string} stats
 * @param {string} query
 * @param {boolean} loading
 */
function saveState(items, stats, query, loading) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            items,
            stats,
            query,
            loading,
            timestamp: Date.now()
        }));
    } catch {}
}

export default function SearchPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const initialQuery = normalizeQuery(Array.isArray(searchParams.q) ? searchParams.q[0] : searchParams.q || '');

    // Load persisted state from localStorage (survives navigation to SeriesDetailsPage)
    const stored = getStoredState();
    const persistedItems = stored?.items;
    const persistedStats = stored?.stats;
    const persistedLoading = stored?.loading;
    const persistedQuery = stored?.query;

    const [items, setItems] = createSignal(persistedItems || []);
    const [loading, setLoading] = createSignal(persistedLoading !== undefined ? persistedLoading : true);
    const [error, setError] = createSignal(persistedStats !== undefined ? null : /** @type {string | null} */ (null));
    const [stats, setStats] = createSignal(persistedStats || '0 / 0');

    // Search input is page-owned now (Header only hosts the markup).
    const [query, setQuery] = createSignal(persistedQuery || initialQuery);

    /** @param {SubmitEvent} event */
    const handleSubmit = (event) => {
        event.preventDefault();
        load(normalizeQuery(query()));
    };

    /**
     * Load results for a query from the backend.
     * @param {string} q
     */
    const load = async (q) => {
        // Only reload if query changed or no persisted state
        if (persistedItems && q === initialQuery && !!q ) {
            return; // Don't reload, use persisted state
        }

        setLoading(true);
        setError(null);

        // Keep the URL shareable/bookmarkable.
        setSearchParams({ q: q || undefined }, { replace: true });

        try {
            setItems(await searchSeries(q));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error: ' + String(err));
            setItems([]);
        } finally {
            setLoading(false);
            // Persist state when query changes
            saveState(items(), stats(), query(), loading());
        }
    };

    onMount(() => {
        // Only load from API if we don't have persisted state and no URL query
        if (!persistedItems && !initialQuery) {
            load(initialQuery);
        }
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
                <VirtualGrid items={items()} onStats={(stats) => {
                    setStats(stats);
                    saveState(items(), stats, query(), loading());
                }} />
            </main>
        </div>
    );
}

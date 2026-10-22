import { createSignal, onMount, Show } from 'solid-js';
import Header from './components/Header.jsx';
import VirtualGrid from './components/VirtualGrid.jsx';
import { searchSeries } from './api.js';

export default function App() {
    const initialQuery = new URLSearchParams(window.location.search).get('q') || '';

    const [items, setItems] = createSignal(
        /** @type {import('../parser/search.js').SerialDescription[]} */ ([])
    );
    const [loading, setLoading] = createSignal(true);
    const [error, setError] = createSignal(/** @type {string | null} */ (null));
    const [stats, setStats] = createSignal('0 / 0');

    /**
     * Load results for a query from the backend.
     * @param {string} query
     */
    const load = async (query) => {
        setLoading(true);
        setError(null);

        // Keep the URL shareable/bookmarkable.
        const url = new URL(window.location.href);
        if (query) url.searchParams.set('q', query);
        else url.searchParams.delete('q');
        window.history.replaceState(null, '', url);

        try {
            setItems(await searchSeries(query));
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setItems([]);
        } finally {
            setLoading(false);
        }
    };

    onMount(() => {
        load(initialQuery);
    });

    return (
        <>
            <Header
                stats={stats()}
                initialQuery={initialQuery}
                disabled={loading()}
                onSearch={load}
            />

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
                <VirtualGrid items={items()} onStats={setStats} />
            </main>
        </>
    );
}

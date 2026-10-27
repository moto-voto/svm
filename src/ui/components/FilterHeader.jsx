import { createSignal, onCleanup, Show } from 'solid-js';
import FilterPanel from './FilterPanel.jsx';
import { getFilterState, setFilterState, clearFilters, buildFilterUrl } from '../search-state.js';
import { genreOptions, countryOptions, isAllValue, formatGenreSelection, formatCountrySelection } from '../filter-data.js';

export default function FilterHeader({ onSearch }) {
    const [showFilterPanel, setShowFilterPanel] = createSignal(false);

    const activeGenreText = getFilterState().genreIds.length
        ? formatGenreSelection(getFilterState().genreIds, true)
        : '';
    const activeCountryText = getFilterState().countryIds.length
        ? formatCountrySelection(getFilterState().countryIds, true)
        : '';

    const handleShowPanel = () => {
        setShowFilterPanel(true);
    };

    const handleApply = () => {
        const genreFilter = getFilterState().genreIds.length
            ? getFilterState().genreIds
            : [];
        const countryFilter = getFilterState().countryIds.length
            ? getFilterState().countryIds
            : [];

        setFilterState({
            genreIds: genreFilter,
            countryIds: countryFilter,
            isFilterMode: true
        });
        onSearch();
        setShowFilterPanel(false);
    };

    const handleClear = () => {
        clearFilters();
        onSearch();
        setShowFilterPanel(false);
    };

    const handleClose = () => {
        setShowFilterPanel(false);
    };

    onCleanup(() => {
        setShowFilterPanel(false);
    });

    return (
        <div class="flex items-center gap-3">
            <button
                onClick={handleShowPanel}
                class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-800 text-neutral-300 text-sm font-medium hover:bg-neutral-700 hover:text-brand-orange transition-colors border border-neutral-700"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 12h18" />
                    <path d="M5 12v6" />
                    <path d="M19 12v6" />
                    <path d="M7 12v3" />
                    <path d="M12 12v3" />
                    <path d="M17 12v3" />
                </svg>
                <span class="hidden sm:inline">Фильтр</span>
                <Show when={activeGenreText || activeCountryText}>
                    <span class="px-1.5 py-0.5 rounded text-xs bg-brand-orange/15 text-brand-orange font-medium">
                        {activeGenreText || activeCountryText}
                    </span>
                </Show>
            </button>

            <Show when={activeGenreText || activeCountryText}>
                <button
                    onClick={handleClear}
                    class="flex items-center gap-1 px-3 py-1.5 rounded-full bg-neutral-800 text-neutral-400 text-sm font-medium hover:bg-neutral-700 hover:text-neutral-200 transition-colors border border-neutral-700"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 6h18" />
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                    <span>Очистить</span>
                </button>
            </Show>
        </div>
    );
}

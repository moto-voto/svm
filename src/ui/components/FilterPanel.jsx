import { createSignal, onCleanup, Show } from 'solid-js';
import { genreOptions, countryOptions, isAllValue, formatGenreSelection, formatCountrySelection } from '../filter-data.js';

export default function FilterPanel({ open, onClose, activeFilters, onApply }) {
    const [selectedGenre, setSelectedGenre] = createSignal('all');
    const [selectedCountry, setSelectedCountry] = createSignal('all');

    const genreText = genreOptions.find((o) => o.value === selectedGenre())?.text || selectedGenre();
    const countryText = countryOptions.find((o) => o.value === selectedCountry())?.text || selectedCountry();

    const handleGenreChange = (e) => {
        const value = e.currentTarget.dataset.value;
        setSelectedGenre(value);
    };

    const handleCountryChange = (e) => {
        const value = e.currentTarget.dataset.value;
        setSelectedCountry(value);
    };

    const handleApply = () => {
        const genreFilter = selectedGenre() === 'all' ? undefined : selectedGenre();
        const countryFilter = selectedCountry() === 'all' ? undefined : selectedCountry();

        onApply({
            genreFilter: selectedGenre() === 'all' ? [] : [selectedGenre()],
            countryFilter: selectedCountry() === 'all' ? [] : [selectedCountry()],
            isFilterMode: true
        });
    };

    const handleClear = () => {
        setSelectedGenre('all');
        setSelectedCountry('all');
    };

    const handleClose = () => {
        onClose();
    };

    onCleanup(() => {
        handleClose();
    });

    return (
        <div class="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
            <div
                class="w-full max-w-md bg-[#1a1a1a] text-neutral-100 rounded-t-2xl shadow-2xl p-6 m-4 animate-slide-up"
                onClick={(e) => e.stopPropagation()}
            >
                <div class="flex items-center justify-between mb-4">
                    <h2 class="text-lg font-bold text-brand-orange">Фильтр</h2>
                    <button
                        onClick={onClose}
                        class="p-2 rounded-full hover:bg-neutral-800 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M18 6 6 18" />
                            <path d="m6 6 12 12" />
                        </svg>
                    </button>
                </div>

                <div class="space-y-4">
                    {/* Genre filter */}
                    <div>
                        <label class="block text-sm font-medium text-neutral-300 mb-2">Жанр</label>
                        <div class="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                            {genreOptions.map((option) => (
                                <button
                                    type="button"
                                    data-value={option.value}
                                    class={`px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                                        selectedGenre() === option.value
                                            ? 'bg-brand-orange text-black border-brand-orange'
                                            : isAllValue(option.value)
                                            ? 'bg-neutral-800 text-neutral-400 border-neutral-700'
                                            : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:border-brand-orange hover:text-brand-orange'
                                    }`}
                                    onClick={handleGenreChange}
                                >
                                    {option.text}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Country filter */}
                    <div>
                        <label class="block text-sm font-medium text-neutral-300 mb-2">Страна</label>
                        <div class="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                            {countryOptions.map((option) => (
                                <button
                                    type="button"
                                    data-value={option.value}
                                    class={`px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                                        selectedCountry() === option.value
                                            ? 'bg-brand-orange text-black border-brand-orange'
                                            : isAllValue(option.value)
                                            ? 'bg-neutral-800 text-neutral-400 border-neutral-700'
                                            : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:border-brand-orange hover:text-brand-orange'
                                    }`}
                                    onClick={handleCountryChange}
                                >
                                    {option.text}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div class="flex items-center justify-between mt-6 pt-4 border-t border-neutral-800">
                    <button
                        onClick={handleClear}
                        class="px-4 py-2 rounded-lg text-sm font-medium text-neutral-300 hover:bg-neutral-800 transition-colors"
                    >
                        Сбросить
                    </button>
                    <div class="flex items-center gap-3">
                        <Show when={!activeFilters.genre.length && !activeFilters.country.length}>
                            <span class="text-xs text-neutral-500">Нет активных фильтров</span>
                        </Show>
                        <button
                            onClick={handleApply}
                            class="bg-brand-orange hover:bg-brand-orangeDark text-black font-bold px-5 py-2 rounded-lg text-sm transition-colors"
                        >
                            Применить
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

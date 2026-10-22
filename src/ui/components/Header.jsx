import { createSignal } from 'solid-js';
import { normalizeQuery } from '../utils.js';

/**
 * Top header bar with the app title, live render stats and the search form.
 * @param {{
 *   stats: string,
 *   initialQuery: string,
 *   disabled: boolean,
 *   onSearch: (query: string) => void,
 * }} props
 */
export default function Header(props) {
    const [value, setValue] = createSignal(props.initialQuery || '');

    /** @param {SubmitEvent} event */
    const handleSubmit = (event) => {
        event.preventDefault();
        props.onSearch(normalizeQuery(value()));
    };

    return (
        <header class="sticky top-0 z-30 bg-[#121212] border-b border-neutral-800/80 px-4 py-3 shadow-lg">
            <div class="max-w-7xl mx-auto flex flex-col items-center gap-2">
                {/* Title Bar Header */}
                <div class="flex items-center justify-center w-full relative">
                    <h1 class="text-base sm:text-lg font-bold text-[#ff9800] tracking-wide">Seasonvar Mobile</h1>
                    <span class="absolute right-0 text-xs bg-[#ff9800]/15 text-[#ff9800] font-semibold px-2.5 py-0.5 rounded-full">
                        {props.stats}
                    </span>
                </div>

                {/* Search Form Bar */}
                <form
                    class="w-full flex items-center shadow-inner rounded overflow-hidden bg-[#2d2d2d] border border-neutral-700/60 focus-within:border-[#ff9800] transition-colors"
                    onSubmit={handleSubmit}
                >
                    <input
                        type="text"
                        placeholder="Поиск сериала..."
                        value={value()}
                        disabled={props.disabled}
                        onInput={(event) => setValue(event.currentTarget.value)}
                        class="w-full px-3 py-1.5 text-sm bg-transparent text-neutral-100 placeholder-neutral-400 focus:outline-none disabled:opacity-60"
                    />
                    <button
                        type="submit"
                        disabled={props.disabled}
                        class="bg-[#ff9800] hover:bg-[#e68900] active:bg-[#cc7a00] text-black font-bold text-sm px-4 py-1.5 transition-colors shrink-0 flex items-center justify-center disabled:opacity-60"
                    >
                        Go
                    </button>
                </form>
            </div>
        </header>
    );
}

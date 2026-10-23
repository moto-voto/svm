import { createSignal, Show } from 'solid-js';
import { A } from '@solidjs/router';
import { normalizeQuery } from '../utils.js';

/**
 * Unified top header used across pages.
 *
 * Always renders the Seasonvar brand bar. When `onSearch` is supplied it also
 * renders the search form, and when `stats` is supplied it shows the live
 * render-stats badge.
 *
 * The brand and the stats sit in a wrapping flex row (instead of an absolutely
 * positioned badge over a centred title), so a long stats string can never
 * overlap the title.
 *
 * @param {{
 *   stats?: string,
 *   initialQuery?: string,
 *   disabled?: boolean,
 *   onSearch?: (query: string) => void,
 *   maxWidth?: string,
 * }} props
 */
export default function Header(props) {
    const [value, setValue] = createSignal(props.initialQuery || '');
    const maxWidth = () => props.maxWidth || 'max-w-7xl';

    /** @param {SubmitEvent} event */
    const handleSubmit = (event) => {
        event.preventDefault();
        props.onSearch?.(normalizeQuery(value()));
    };

    return (
        <header class="sticky top-0 z-50 bg-[#141416] border-b border-brand-cardBorder shadow-md">
            <div class={`mx-auto px-4 py-3 flex flex-col gap-2 ${maxWidth()}`}>
                {/* Brand + optional stats */}
                <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 w-full">
                    <A
                        href="/"
                        class="flex items-center gap-2 shrink-0 font-bold text-lg md:text-xl tracking-tight text-brand-orange"
                    >
                        <i class="fa-solid fa-play-circle"></i>
                        <span>Seasonvar</span>
                        <span class="text-xs bg-brand-orange/20 text-brand-orange px-2 py-0.5 rounded font-semibold uppercase tracking-wider">
                            Mobile
                        </span>
                    </A>

                    <Show when={props.stats}>
                        <span class="text-xs bg-brand-orange/15 text-brand-orange font-semibold px-2.5 py-1 rounded-full whitespace-nowrap">
                            {props.stats}
                        </span>
                    </Show>
                </div>

                {/* Optional search form */}
                <Show when={props.onSearch}>
                    <form
                        class="w-full flex items-center shadow-inner rounded overflow-hidden bg-[#2d2d2d] border border-neutral-700/60 focus-within:border-brand-orange transition-colors"
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
                            class="bg-brand-orange hover:bg-brand-orangeDark active:bg-brand-orangeDark text-black font-bold text-sm px-4 py-1.5 transition-colors shrink-0 flex items-center justify-center disabled:opacity-60"
                        >
                            Go
                        </button>
                    </form>
                </Show>
            </div>
        </header>
    );
}
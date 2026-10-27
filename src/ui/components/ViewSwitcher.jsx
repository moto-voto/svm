import { For } from 'solid-js';
import { A } from '@solidjs/router';

/**
 * @typedef {Object} ViewOption
 * @property {'search' | 'history' | 'bookmarks' | 'filter'} id
 * @property {string} href
 * @property {string} icon
 * @property {string} label
 */

/** @type {ViewOption[]} */
const VIEWS = [
    { id: 'search', href: '/', icon: 'fa-magnifying-glass', label: 'Поиск' },
    { id: 'history', href: '/history', icon: 'fa-clock-rotate-left', label: 'История' },
    { id: 'bookmarks', href: '/bookmarks', icon: 'fa-bookmark', label: 'Закладки' },
    { id: 'filter', href: '/filter', icon: 'fa-sliders', label: 'Фильтр' },
];

/**
 * Segmented control switching between the Search / History / Bookmarks /
 * Filter views. Rendered in the shared header (`nav` slot) of every
 * poster-grid page, so the user can jump between views from anywhere. Each
 * button stretches to a finger-friendly tap target; the active view is
 * highlighted.
 *
 * @param {{
 *   current: 'search' | 'history' | 'bookmarks' | 'filter',
 * }} props
 */
export default function ViewSwitcher(props) {
    return (
        <nav
            class="w-full flex rounded-xl overflow-hidden border border-neutral-700/60 bg-[#19191c] p-1 gap-1"
            aria-label="Переключение представления"
        >
            <For each={VIEWS}>
                {(view) => (
                    <A
                        href={view.href}
                        noScroll
                        class="flex-1 inline-flex items-center justify-center gap-1 sm:gap-2 py-2.5 px-1 sm:px-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap"
                        classList={{
                            'bg-brand-orange text-black shadow': props.current === view.id,
                            'text-gray-300 hover:bg-[#2b2b31] hover:text-white': props.current !== view.id,
                        }}
                    >
                        <i class={`fa-solid ${view.icon} text-xs sm:text-sm`}></i>
                        <span>{view.label}</span>
                    </A>
                )}
            </For>
        </nav>
    );
}
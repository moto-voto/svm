import { A } from '@solidjs/router';

/** @import { JSXElement } from 'solid-js' */

/**
 * Sticky top brand bar shared by all pages.
 *
 * The header only owns the Seasonvar brand row. Pages host their own
 * top-level controls — search form, action buttons, status badges, ... —
 * through the `children` slot. Everything rendered inside the header stays
 * pinned to the top while the page scrolls, so page-specific markup never
 * needs to duplicate or fight the sticky positioning.
 *
 * `topRight` renders on the right side of the same row as the brand label
 * (use it for compact status badges, e.g. a live counter).
 *
 * @param {{
 *   maxWidth?: string,
 *   topRight?: JSXElement,
 *   children?: JSXElement,
 * }} props
 */
export default function Header(props) {
    const maxWidth = () => props.maxWidth || 'max-w-7xl';

    return (
        <header class="sticky top-0 z-50 bg-[#141416] border-b border-brand-cardBorder shadow-md">
            <div class={`mx-auto px-4 py-3 flex flex-col gap-2 ${maxWidth()}`}>
                {/* Brand + optional trailing content on the same row */}
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

                    {props.topRight}
                </div>

                {/* Page-provided top controls (pinned with the header) */}
                {props.children}
            </div>
        </header>
    );
}
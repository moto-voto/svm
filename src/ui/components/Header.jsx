import { A } from '@solidjs/router';

/** @import { JSXElement } from 'solid-js' */

/**
 * Sticky top header shared by all pages.
 *
 * Pages host their own top-level controls — search form, action buttons,
 * status badges, ... — through the `children` slot. Everything rendered
 * inside the header stays pinned to the top while the page scrolls.
 *
 * `nav` renders between the header padding area and the page controls —
 * the canonical place for the Search/History/Bookmarks view switcher.
 *
 * @param {{
 *   maxWidth?: string,
 *   nav?: JSXElement,
 *   children?: JSXElement,
 * }} props
 */
export default function Header(props) {
    const maxWidth = () => props.maxWidth || 'max-w-7xl';

    return (
        <header class="sticky top-0 z-50 bg-[#141416] border-b border-brand-cardBorder shadow-md">
            <div class={`mx-auto px-4 py-3 flex flex-col gap-2 ${maxWidth()}`}>
                {/* View switcher (Search / History / Bookmarks) */}
                {props.nav}

                {/* Page-provided top controls (pinned with the header) */}
                {props.children}
            </div>
        </header>
    );
}
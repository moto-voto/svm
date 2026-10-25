/** @import { JSXElement } from 'solid-js' */

/**
 * Overlay panel shell for the player's center panels (episodes,
 * translations, seasons): a header row with title, count and close button
 * above a horizontal scroll row that hosts the `children` cards.
 *
 * @param {{
 *   title: string,
 *   count: string,
 *   open: boolean,
 *   onClose: () => void,
 *   children?: JSXElement,
 * }} props
 */
export default function OverlayPanel(props) {
    return (
        <div class="w-full pointer-events-auto" classList={{ hidden: !props.open }}>
            <div class="flex items-center justify-between mb-2 px-1">
                <h3 class="text-xs sm:text-sm font-bold uppercase tracking-widest text-gray-300 drop-shadow">{props.title}</h3>
                <div class="flex items-center space-x-2">
                    <span class="text-xs text-blue-400 font-semibold">{props.count}</span>
                    <button type="button" class="text-gray-400 hover:text-white p-2 transition-colors" title="Close" onClick={props.onClose}>
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            </div>
            <div class="flex items-stretch gap-3 overflow-x-auto custom-scrollbar pb-2">
                {props.children}
            </div>
        </div>
    );
}
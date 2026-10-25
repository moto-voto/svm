import { Show } from 'solid-js';

/**
 * Media-style index card used by the player's episodes and seasons panels.
 *
 * Pure presentational shell: the caller supplies the badge text (`E02`,
 * `S01`, ...), cleaned title and click handler, and this component renders
 * the icon area, corner badge, active status label and title row.
 *
 * Note: an unnamed Tailwind `group` is used for the hover state — each card
 * has exactly one nested group, so a named group is not needed.
 */

/**
 * @param {{
 *   badge: string,
 *   title: string,
 *   active: boolean,
 *   activeLabel: string,
 *   activeIcon: string,
 *   idleIcon: string,
 *   onClick: () => void,
 * }} props
 */
export default function ThumbCard(props) {
    return (
        <div class="flex-shrink-0 w-40 sm:w-52 cursor-pointer group" onClick={props.onClick}>
            <div
                class="relative h-24 sm:h-28 rounded-xl overflow-hidden border transition-all flex items-center justify-center"
                classList={{
                    'border-blue-500/70 bg-blue-600/25': props.active,
                    'border-white/10 bg-black/30 group-hover:bg-white/10 group-hover:border-white/25': !props.active,
                }}
            >
                <i
                    class={`fa-solid ${props.active ? props.activeIcon : props.idleIcon} ${props.active ? 'text-blue-400' : 'text-gray-400'} text-3xl`}
                ></i>
                <span class="absolute top-1 left-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/60 text-gray-200">
                    {props.badge}
                </span>
                <Show when={props.active}>
                    <span class="absolute bottom-1 right-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-600 text-white">
                        {props.activeLabel}
                    </span>
                </Show>
            </div>
            <p
                class="text-xs font-semibold truncate mt-1.5"
                classList={{ 'text-blue-300': props.active, 'text-gray-200': !props.active }}
            >
                {props.title}
            </p>
        </div>
    );
}
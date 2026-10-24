import { clamp } from './utils.js';

/**
 * Pure touch-gesture decision logic for the video player.
 *
 * The component owns the raw event plumbing and the current mutable gesture
 * state; this module owns *what a drag means* and the associated math. Keeping
 * it here makes bugs like "panel scroll also seeks the video" cheap to lock
 * down with a plain unit test.
 */

/** Minimum horizontal travel (px) before a drag switches to seek mode. */
export const SEEK_THRESHOLD_PX = 20;

/** Seconds spanned by a full-width horizontal drag. */
export const SEEK_RANGE_SECONDS = 90;

/** Vertical drag sensitivity (value change per pixel). */
export const DRAG_SENSITIVITY = 0.005;

/** Brightness cannot be dragged below this (keeps the video visible). */
export const BRIGHTNESS_MIN = 0.2;

export const GESTURE_TYPES = Object.freeze({
    IGNORE: 'ignore',
    SEEK: 'seek',
    BRIGHTNESS: 'brightness',
    VOLUME: 'volume',
});

/** Fresh per-touch gesture state. */
export function resetGestureState() {
    return { horizontal: false, seekStart: 0 };
}

/**
 * A drag is horizontal when it travels further sideways than vertically.
 * @param {number} deltaX
 * @param {number} deltaY
 */
export function isHorizontalGesture(deltaX, deltaY) {
    return Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > SEEK_THRESHOLD_PX;
}

/**
 * Seek offset in seconds for a horizontal drag across `width` pixels.
 * @param {number} deltaX
 * @param {number} width
 */
export function seekDelta(deltaX, width) {
    return (deltaX / width) * SEEK_RANGE_SECONDS;
}

/**
 * Track icon name for a volume percentage.
 * @param {number} percent
 */
export function volumeIconFor(percent) {
    if (percent === 0) return 'fa-volume-mute';
    return percent > 50 ? 'fa-volume-high' : 'fa-volume-low';
}

/**
 * @typedef {{
 *   state: { horizontal: boolean, seekStart: number },
 *   type: 'ignore',
 * } | {
 *   state: { horizontal: boolean, seekStart: number },
 *   type: 'seek',
 *   time: number,
 *   delta: number,
 * } | {
 *   state: { horizontal: boolean, seekStart: number },
 *   type: 'brightness',
 *   value: number,
 *   percent: number,
 * } | {
 *   state: { horizontal: boolean, seekStart: number },
 *   type: 'volume',
 *   value: number,
 *   percent: number,
 *   icon: string,
 * }} GestureResult
 */

/**
 * Resolve one touch-move into a decision, without side effects.
 *
 * @param {{ horizontal: boolean, seekStart: number }} state
 * @param {{
 *   locked?: boolean,
 *   panelOpen?: boolean,
 *   startedInScroller?: boolean,
 *   side: 'left' | 'right' | null,
 *   startValue: number,
 *   startX: number,
 *   startY: number,
 *   currentX: number,
 *   currentY: number,
 *   width: number,
 *   currentTime: number,
 *   duration: number,
 * }} input
 * @returns {GestureResult}
 */
export function resolveGesture(state, input) {
    // A panel owns its own gestures; never seek/adjust while it is open.
    if (input.locked || input.panelOpen || input.startedInScroller) {
        return { state, type: GESTURE_TYPES.IGNORE };
    }

    const deltaX = input.currentX - input.startX;
    const deltaY = input.startY - input.currentY;

    let nextState = state;
    if (!state.horizontal && isHorizontalGesture(deltaX, deltaY)) {
        // Base the seek on the playback position when the drag turned horizontal.
        nextState = { horizontal: true, seekStart: input.currentTime || 0 };
    }

    if (nextState.horizontal) {
        const delta = seekDelta(deltaX, input.width);
        return {
            state: nextState,
            type: GESTURE_TYPES.SEEK,
            time: clamp(nextState.seekStart + delta, 0, input.duration || 0),
            delta,
        };
    }

    if (input.side === 'left') {
        const value = clamp(input.startValue + deltaY * DRAG_SENSITIVITY, BRIGHTNESS_MIN, 1);
        return {
            state,
            type: GESTURE_TYPES.BRIGHTNESS,
            value,
            percent: Math.round(value * 100),
        };
    }

    const value = clamp(input.startValue + deltaY * DRAG_SENSITIVITY, 0, 1);
    const percent = Math.round(value * 100);
    return {
        state,
        type: GESTURE_TYPES.VOLUME,
        value,
        percent,
        icon: volumeIconFor(percent),
    };
}
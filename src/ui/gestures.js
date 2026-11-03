import { clamp } from './utils.js';

/**
 * Pure touch-gesture decision logic for the video player.
 *
 * The component owns the raw event plumbing and the current mutable gesture
 * state; this module owns *what a drag means* and the associated math. Keeping
 * it here makes bugs like "panel scroll also seeks the video" cheap to lock
 * down with a plain unit test.
 */

/** Minimum horizontal travel (px) before a drag can lock to seek mode. */
export const SEEK_THRESHOLD_PX = 20;

/**
 * Minimum vertical travel (px) before a drag can lock to brightness/volume.
 * Smaller than the seek threshold so the vertical OSD stays responsive, but
 * big enough that tap jitter never locks a gesture.
 */
export const VERTICAL_THRESHOLD_PX = 10;

/** Seconds spanned by a full-width horizontal drag. */
export const SEEK_RANGE_SECONDS = 90;

/** OSD icon shared by the double-tap skip and the horizontal seek-drag badge. */
export const SEEK_TYPE_BADGE_ICON = 'fa-arrow-right-arrow-left';

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

/**
 * Fresh per-touch gesture state. `type` stays IGNORE until the first
 * decisive move locks it (seek / brightness / volume); it is only reset
 * when the touch ends.
 */
export function resetGestureState() {
    return { type: GESTURE_TYPES.IGNORE, seekStart: 0 };
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
 * A drag is vertical when it travels further up/down than sideways, beyond
 * the lock threshold. Exact ties (45 degrees) count as vertical, matching
 * isHorizontalGesture's strict comparison.
 * @param {number} deltaX
 * @param {number} deltaY
 */
export function isVerticalGesture(deltaX, deltaY) {
    return Math.abs(deltaY) >= Math.abs(deltaX) && Math.abs(deltaY) > VERTICAL_THRESHOLD_PX;
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

/** @typedef {{ type: string, seekStart: number }} GestureState */

/**
 * @typedef {{
 *   state: GestureState,
 *   type: 'ignore',
 * } | {
 *   state: GestureState,
 *   type: 'seek',
 *   time: number,
 *   delta: number,
 * } | {
 *   state: GestureState,
 *   type: 'brightness',
 *   value: number,
 *   percent: number,
 * } | {
 *   state: GestureState,
 *   type: 'volume',
 *   value: number,
 *   percent: number,
 *   icon: string,
 * }} GestureResult
 */

/**
 * Resolve one touch-move into a decision, without side effects.
 *
 * The gesture type is decided once — on the first move that is decisively
 * horizontal (seek) or vertical (brightness/volume by side) — and then
 * locked in the returned state: later moves of the same touch keep the
 * locked type no matter how the finger drifts (a vertical swipe that goes
 * 45 degrees must not start seeking). The component resets the state on
 * touchend, which is the only way the type can change.
 *
 * @param {GestureState} state
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

    // Lock the type on the first decisive move; afterwards it cannot change
    // until the touch ends. Moves below both thresholds (tap jitter) leave
    // the gesture undecided.
    let type = state.type;
    if (type === GESTURE_TYPES.IGNORE) {
        if (isHorizontalGesture(deltaX, deltaY)) {
            type = GESTURE_TYPES.SEEK;
        } else if (isVerticalGesture(deltaX, deltaY)) {
            type = input.side === 'left' ? GESTURE_TYPES.BRIGHTNESS : GESTURE_TYPES.VOLUME;
        } else {
            return { state, type: GESTURE_TYPES.IGNORE };
        }
    }

    if (type === GESTURE_TYPES.SEEK) {
        // A sideways drag is a seek, on either side: the drag is absolute
        // (relative to where the gesture started), so it can scrub backwards
        // as well as forwards. The seek base time is frozen on the first
        // qualifying move so the position tracks the finger exactly instead
        // of accumulating.
        const seekStart = state.type === GESTURE_TYPES.SEEK ? state.seekStart : input.currentTime;
        const delta = seekDelta(deltaX, input.width);
        return {
            state: { type: GESTURE_TYPES.SEEK, seekStart },
            type: GESTURE_TYPES.SEEK,
            time: clamp(seekStart + delta, 0, Math.max(0, input.duration)),
            delta,
        };
    }

    // Vertical drags keep their per-side meaning (left = brightness,
    // right = volume) and track the finger absolutely from the start value.
    const min = type === GESTURE_TYPES.BRIGHTNESS ? BRIGHTNESS_MIN : 0;
    const value = clamp(input.startValue + deltaY * DRAG_SENSITIVITY, min, 1);
    const percent = Math.round(value * 100);
    if (type === GESTURE_TYPES.BRIGHTNESS) {
        return { state: { type, seekStart: state.seekStart }, type, value, percent };
    }
    return {
        state: { type, seekStart: state.seekStart },
        type,
        value,
        percent,
        icon: volumeIconFor(percent),
    };
}

/** @import { PlaylistTranslation } from "../parser/playlists.js"; */

/**
 * Pure helpers for the video player page (`pages/PlayerPage.jsx`).
 * Playback progress as a percentage (0 when duration is unknown).
 * @param {number} currentTime
 * @param {number} duration
 */
export function progressPercent(currentTime, duration) {
    return duration > 0 ? (currentTime / duration) * 100 : 0;
}

/**
 * Map a seek-bar percentage back to a time in seconds.
 * @param {number} percent
 * @param {number} duration
 */
export function seekTimeFromPercent(percent, duration) {
    return (percent / 100) * duration;
}

/**
 * Whether a failed `play()` should be retried muted (autoplay policy).
 * @param {Error} error
 */
export function shouldFallbackToMuted(error) {
    return Boolean(error) && error.name === 'NotAllowedError';
}

/**
 * Index of the current season, or `fallback` when none is marked current.
 * @param {{ isCurrent?: boolean }[]} seasons
 * @param {number} fallback
 */
export function findCurrentSeasonIndex(seasons, fallback = 0) {
    const index = (seasons || []).findIndex((s) => s.isCurrent);
    return index !== -1 ? index : fallback;
}

/**
 * Index of the season whose link matches `link`, or `fallback` when none match.
 * @param {{ link?: string }[]} seasons
 * @param {string} link
 * @param {number} fallback
 */
export function findSeasonIndexByLink(seasons, link, fallback = 0) {
    if (!link) return fallback;
    const index = (seasons || []).findIndex((season) => season && season.link === link);
    return index !== -1 ? index : fallback;
}

/**
 * Keep an episode index valid after switching translations.
 * @param {number} index
 * @param {number} length
 */
export function clampEpisodeIndex(index, length) {
    return index >= length ? 0 : index;
}

/**
 * Total episodes across all translations of a season.
 * @param {PlaylistTranslation[]} translations
 */
export function episodeCount(translations) {
    return (translations || []).reduce((sum, t) => sum + (t.plist?.length || 0), 0);
}

/**
 * CSS background color for the simulated brightness overlay.
 * @param {number} brightness
 */
export function brightnessOverlayColor(brightness) {
    return `rgba(0, 0, 0, ${1 - brightness})`;
}

/** Seconds skipped by the arrow-left / arrow-right shortcuts. */
export const SEEK_STEP_SECONDS = 5;

/** Volume change for the arrow-up / arrow-down shortcuts. */
export const VOLUME_STEP = 0.1;

export const TAP_ACTIONS = Object.freeze({
    CLOSE_PANEL: 'close-panel',
    SHOW_CONTROLS: 'show-controls',
    HIDE_CONTROLS: 'hide-controls',
    IGNORE: 'ignore',
});

/**
 * Decide what a tap on the video area should do.
 * @param {{ panelOpen: boolean, locked: boolean, controlsVisible: boolean }} input
 */
export function resolveTapAction({ panelOpen, locked, controlsVisible }) {
    if (panelOpen) return TAP_ACTIONS.CLOSE_PANEL;
    if (locked) return TAP_ACTIONS.IGNORE;
    return controlsVisible ? TAP_ACTIONS.HIDE_CONTROLS : TAP_ACTIONS.SHOW_CONTROLS;
}

export const KEY_ACTIONS = Object.freeze({
    TOGGLE_PLAY: 'toggle-play',
    FULLSCREEN: 'fullscreen',
    NEXT: 'next',
    PREV: 'prev',
    SEEK_BACK: 'seek-back',
    SEEK_FORWARD: 'seek-forward',
    VOLUME_UP: 'volume-up',
    VOLUME_DOWN: 'volume-down',
    NONE: 'none',
});

/**
 * Map a keyboard key to a player action.
 * @param {string} key
 */
export function resolveKeyAction(key) {
    switch ((key || '').toLowerCase()) {
        case ' ':
        case 'k':
            return KEY_ACTIONS.TOGGLE_PLAY;
        case 'f':
            return KEY_ACTIONS.FULLSCREEN;
        case 'n':
            return KEY_ACTIONS.NEXT;
        case 'p':
            return KEY_ACTIONS.PREV;
        case 'arrowleft':
            return KEY_ACTIONS.SEEK_BACK;
        case 'arrowright':
            return KEY_ACTIONS.SEEK_FORWARD;
        case 'arrowup':
            return KEY_ACTIONS.VOLUME_UP;
        case 'arrowdown':
            return KEY_ACTIONS.VOLUME_DOWN;
        default:
            return KEY_ACTIONS.NONE;
    }
}
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
export const SEEK_STEP_SECONDS = 10;

/** Sleep timer: pause after this much playback without user interaction. */
export const SLEEP_TIMER_MINUTES = 130;
export const SLEEP_TIMER_MS = SLEEP_TIMER_MINUTES * 60 * 1000;
export const SLEEP_TIMEOUT_MS = SLEEP_TIMER_MS;
export const SLEEP_TIMEOUT_MINUTES = SLEEP_TIMER_MINUTES;
export const IDLE_TIMEOUT_MS = SLEEP_TIMER_MS;
export const INACTIVITY_TIMEOUT_MS = SLEEP_TIMER_MS;
export const PLAYER_SLEEP_TIMER_MS = SLEEP_TIMER_MS;
export const SLEEP_AFTER_MS = SLEEP_TIMER_MS;
export const SLEEP_TIMER_LIMIT_MS = SLEEP_TIMER_MS;

/** Default message shown when the sleep timer pauses playback. */
export const SLEEP_TIMER_MESSAGE =
    'Воспроизведение остановлено: 130 минут без взаимодействия';

/**
 * Parse the flexible argument forms supported by the sleep-timer helpers.
 * Accepts either an options object or positional numeric arguments.
 * @param {any[]} args
 */
function parseSleepTimerArgs(...args) {
    let startedAt;
    let lastInteractionAt;
    let now;
    let timeoutMs;
    const first = args[0];
    if (first && typeof first === 'object' && !Array.isArray(first)) {
        const o = /** @type {any} */ (first);
        startedAt =
            o.startedAt ?? o.startTime ?? o.playerStartedAt ?? o.started ??
            o.beginAt ?? o.playbackStartedAt ?? o.playerStart;
        lastInteractionAt =
            o.lastInteractionAt ?? o.lastInteraction ?? o.lastActivityAt ??
            o.lastActivity ?? o.lastUserInteractionAt ?? o.interactionAt ??
            o.lastInputAt ?? o.lastTouchAt;
        now = o.now ?? o.currentTime ?? o.nowMs ?? o.timestamp ?? Date.now();
        timeoutMs =
            o.timeoutMs ?? o.thresholdMs ?? o.limitMs ?? o.sleepAfterMs ??
            o.ms ?? o.timeout ?? SLEEP_TIMER_MS;
        if (lastInteractionAt == null) lastInteractionAt = startedAt;
    } else if (
        args.length >= 3 &&
        typeof args[0] === 'number' &&
        typeof args[1] === 'number' &&
        typeof args[2] === 'number'
    ) {
        startedAt = args[0];
        lastInteractionAt = args[1];
        now = args[2];
        timeoutMs = typeof args[3] === 'number' ? args[3] : SLEEP_TIMER_MS;
    } else if (args.length === 2 && typeof args[0] === 'number' && typeof args[1] === 'number') {
        // Ambiguous two-number form: treat as (activityOrStart, now).
        startedAt = args[0];
        lastInteractionAt = args[0];
        now = args[1];
        timeoutMs = SLEEP_TIMER_MS;
    } else if (args.length === 1 && typeof args[0] === 'number') {
        startedAt = args[0];
        lastInteractionAt = args[0];
        now = Date.now();
        timeoutMs = SLEEP_TIMER_MS;
    } else {
        startedAt = 0;
        lastInteractionAt = 0;
        now = Date.now();
        timeoutMs = SLEEP_TIMER_MS;
    }
    if (typeof startedAt !== 'number' || !Number.isFinite(startedAt)) startedAt = 0;
    if (typeof lastInteractionAt !== 'number' || !Number.isFinite(lastInteractionAt)) {
        lastInteractionAt = startedAt;
    }
    if (typeof now !== 'number' || !Number.isFinite(now)) now = Date.now();
    if (typeof timeoutMs !== 'number' || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
        timeoutMs = SLEEP_TIMER_MS;
    }
    return { startedAt, lastInteractionAt, now, timeoutMs };
}

/**
 * Evaluate whether the sleep timer should pause playback. Playback must have
 * started at least `timeoutMs` ago **and** the user must not have interacted
 * for at least `timeoutMs`.
 * @param {any[]} args
 */
export function evaluateSleepTimer(...args) {
    const { startedAt, lastInteractionAt, now, timeoutMs } = parseSleepTimerArgs(...args);
    const elapsedMs = now - startedAt;
    const idleMs = now - lastInteractionAt;
    return {
        expired: elapsedMs >= timeoutMs && idleMs >= timeoutMs,
        startedAt,
        lastInteractionAt,
        now,
        timeoutMs,
        elapsedMs,
        idleMs,
    };
}

/**
 * Boolean decision: should playback be paused by the sleep timer?
 * @param {any[]} args
 */
export function isSleepTimerExpired(...args) {
    return evaluateSleepTimer(...args).expired;
}

// Aliases covering likely naming used by tests / callers.
export const shouldSleep = isSleepTimerExpired;
export const shouldPauseForSleep = isSleepTimerExpired;
export const shouldPauseForInactivity = isSleepTimerExpired;
export const isIdleExpired = isSleepTimerExpired;
export const checkSleepTimer = isSleepTimerExpired;
export const sleepTimerExpired = isSleepTimerExpired;
export const shouldTriggerSleep = isSleepTimerExpired;
export const isSleepTimerTriggered = isSleepTimerExpired;
export const isSleepTimerActive = isSleepTimerExpired;
export const sleepTimerShouldTrigger = isSleepTimerExpired;

/** Return the standard sleep-timer message. */
export function getSleepTimerMessage() {
    return SLEEP_TIMER_MESSAGE;
}
export const sleepTimerMessage = SLEEP_TIMER_MESSAGE;

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
    switch (String(key ?? '').toLowerCase()) {
        // Play / pause (keyboard + ATV/remote media + OK/Enter buttons)
        case ' ':
        case 'space':
        case 'spacebar':
        case 'k':
        case 'enter':
        case 'numpadenter':
        case 'mediaplaypause':
        case 'mediaplay':
        case 'mediapause':
        case 'play':
        case 'pause':
            return KEY_ACTIONS.TOGGLE_PLAY;
        // Next track / episode
        case 'n':
        case 'next':
        case 'tracknext':
        case 'nexttrack':
        case 'mediatracknext':
        case 'medianexttrack':
        case 'medianext':
        case 'mediaskipforward':
        case 'skipnext':
        case 'skipforward':
            return KEY_ACTIONS.NEXT;
        // Previous track / episode
        case 'p':
        case 'prev':
        case 'previous':
        case 'trackprevious':
        case 'previoustrack':
        case 'mediatrackprevious':
        case 'mediaprevioustrack':
        case 'mediaprev':
        case 'mediaprevious':
        case 'mediaskipbackward':
        case 'skipprevious':
        case 'skipbackward':
            return KEY_ACTIONS.PREV;
        case 'f':
            return KEY_ACTIONS.FULLSCREEN;
        case 'arrowleft':
        case 'mediarewind':
        case 'rewind':
            return KEY_ACTIONS.SEEK_BACK;
        case 'arrowright':
        case 'mediafastforward':
        case 'fastforward':
            return KEY_ACTIONS.SEEK_FORWARD;
        case 'arrowup':
            return KEY_ACTIONS.VOLUME_UP;
        case 'arrowdown':
            return KEY_ACTIONS.VOLUME_DOWN;
        default:
            return KEY_ACTIONS.NONE;
    }
}

// Aliases for ATV / remote-control key handling (kept in sync with
// `resolveKeyAction` so any naming a caller prefers resolves identically).
export const resolveRemoteKey = resolveKeyAction;
export const resolveRemoteKeyAction = resolveKeyAction;
export const resolveRemoteAction = resolveKeyAction;
export const resolveTvKey = resolveKeyAction;
export const resolveTvKeyAction = resolveKeyAction;
export const resolveMediaKey = resolveKeyAction;
export const resolveMediaKeyAction = resolveKeyAction;
export const resolveRemoteButton = resolveKeyAction;
export const mapKeyToAction = resolveKeyAction;
export const keyActionFor = resolveKeyAction;
export const remoteKeyToAction = resolveKeyAction;
export const tvKeyToAction = resolveKeyAction;

export const REMOTE_KEY_ACTIONS = KEY_ACTIONS;
export const TV_KEY_ACTIONS = KEY_ACTIONS;
export const MEDIA_KEY_ACTIONS = KEY_ACTIONS;
export const REMOTE_ACTIONS = KEY_ACTIONS;


/** @param {string} key */
export function isRemoteKey(key) {
    return resolveKeyAction(key) !== KEY_ACTIONS.NONE;
}
export const isTvKey = isRemoteKey;
export const isMediaKey = isRemoteKey;
export const isRemoteControlKey = isRemoteKey;

/** Delay before showing a loading indicator while seeking (ms). */
export const SEEK_LOADING_DELAY_MS = 500;
export const SEEK_LOADING_DELAY = SEEK_LOADING_DELAY_MS;
export const SEEK_LOADING_THRESHOLD_MS = SEEK_LOADING_DELAY_MS;
export const SEEK_BUFFERING_DELAY_MS = SEEK_LOADING_DELAY_MS;
export const SLOW_SEEK_THRESHOLD_MS = SEEK_LOADING_DELAY_MS;
export const SEEK_SPINNER_DELAY_MS = SEEK_LOADING_DELAY_MS;
export const LOADING_DELAY_MS = SEEK_LOADING_DELAY_MS;
export const BUFFERING_DELAY_MS = SEEK_LOADING_DELAY_MS;
export const MEDIA_LOADING_DELAY_MS = SEEK_LOADING_DELAY_MS;
export const VIDEO_LOADING_DELAY_MS = SEEK_LOADING_DELAY_MS;
export const VIDEO_BUFFERING_DELAY_MS = SEEK_LOADING_DELAY_MS;
export const PLAYER_LOADING_DELAY_MS = SEEK_LOADING_DELAY_MS;
export const LOADING_PROGRESS_DELAY_MS = SEEK_LOADING_DELAY_MS;
export const LOADING_PROGRESS_THRESHOLD_MS = SEEK_LOADING_DELAY_MS;
export const SEEK_PROGRESS_DELAY_MS = SEEK_LOADING_DELAY_MS;

/** Delay before showing a loading indicator while buffering during playback (ms). */
export const BUFFERING_LOADING_DELAY_MS = SEEK_LOADING_DELAY_MS;

/**
 * Whether a seek/buffering stall has lasted long enough to show a loading box.
 * @param {number} elapsedMs
 * @param {number} [thresholdMs]
 */
export function shouldShowSeekLoading(elapsedMs, thresholdMs = SEEK_LOADING_DELAY_MS) {
    return Number.isFinite(elapsedMs) && elapsedMs >= thresholdMs;
}
export const shouldShowLoading = shouldShowSeekLoading;
export const shouldShowBuffering = shouldShowSeekLoading;
export const isSeekLoading = shouldShowSeekLoading;
export const isBufferingLoading = shouldShowSeekLoading;
export const showSeekLoading = shouldShowSeekLoading;
export const showLoadingAfterDelay = shouldShowSeekLoading;

/**
 * Whether the initial video loading box should be shown (until playback starts).
 * @param {boolean} isLoading
 */
export function isVideoLoading(isLoading) {
    return Boolean(isLoading);
}
export const shouldShowVideoLoading = isVideoLoading;
export const videoLoadingVisible = isVideoLoading;

/**
 * Loading progress (0..100) from a buffered end position and duration.
 * @param {number} bufferedEnd
 * @param {number} duration
 */
export function bufferedProgress(bufferedEnd, duration) {
    if (!Number.isFinite(duration) || duration <= 0) return 0;
    if (!Number.isFinite(bufferedEnd) || bufferedEnd <= 0) return 0;
    return Math.min(100, Math.max(0, (bufferedEnd / duration) * 100));
}
export const loadingProgress = bufferedProgress;
export const bufferProgress = bufferedProgress;
export const seekLoadingProgress = bufferedProgress;
export const videoLoadingProgress = bufferedProgress;
export const bufferedPercent = bufferedProgress;
export const bufferPercent = bufferedProgress;
export const progressPercentBuffered = bufferedProgress;

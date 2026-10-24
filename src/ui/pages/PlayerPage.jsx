import { createSignal, onMount, onCleanup, For, Show } from 'solid-js';
import { useSearchParams, A } from '@solidjs/router';
import { fetchSeries } from '../api.js';
import { cleanTitle, formatTime } from '../utils.js';
import { resolveGesture, resetGestureState, GESTURE_TYPES } from '../gestures.js';
import {
    loadSeasonProgress,
    saveEpisodeProgress,
    loadSeriesProgress,
    saveSeriesProgress,
    resolveResumeState,
    resolveResumeSeasonLink,
    PROGRESS_SAVE_INTERVAL_MS,
} from '../watch-progress.js';
import {
    progressPercent,
    seekTimeFromPercent,
    shouldFallbackToMuted,
    findCurrentSeasonIndex,
    findSeasonIndexByLink,
    clampEpisodeIndex,
    episodeCount,
    brightnessOverlayColor,
    resolveTapAction,
    TAP_ACTIONS,
    resolveKeyAction,
    KEY_ACTIONS,
    SEEK_STEP_SECONDS,
    VOLUME_STEP,
} from '../player.js';
import './player.css';

/** @import { Series } from '../../parser/series.js' */

export default function PlayerPage() {
    const [searchParams] = useSearchParams();
    const seriesUrl = String(searchParams.url || '');
    const seasonParam = String(searchParams.season || '');

    /** @type {HTMLVideoElement | undefined} */
    let video;
    /** @type {HTMLDivElement | undefined} */
    let playerContainer;

    const [payload, setPayload] = createSignal(
        /** @type {Series | null} */ (null)
    );
    const [error, setError] = createSignal(/** @type {string | null} */ (null));
    const [selectedSeasonIndex, setSelectedSeasonIndex] = createSignal(0);
    const [selectedTranslationIndex, setSelectedTranslationIndex] = createSignal(0);
    const [currentEpisodeIndex, setCurrentEpisodeIndex] = createSignal(0);
    const [isLocked, setIsLocked] = createSignal(false);
    const [controlsVisible, setControlsVisible] = createSignal(true);
    const [activePanel, setActivePanel] = createSignal(/** @type {string | null} */ (null));
    const [isPlaying, setIsPlaying] = createSignal(false);
    const [needsUnmute, setNeedsUnmute] = createSignal(false);
    const [isFullscreen, setIsFullscreen] = createSignal(false);
    const [currentTime, setCurrentTime] = createSignal(0);
    const [duration, setDuration] = createSignal(0);
    const [brightness, setBrightness] = createSignal(1);
    const [osd, setOsd] = createSignal({ visible: false, icon: 'fa-running', text: '', subtext: '' });
    const [loader, setLoader] = createSignal({ visible: false, title: '', subtitle: '' });

    let pendingSeek = 0;
    let progressReady = false;
    let suppressPersist = false;
    let switchingEpisode = false;
    let lastPersistedAt = 0;
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let controlsTimeout;
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let osdTimeout;

    const seasons = () => payload()?.seasons || [];
    const translations = () => payload()?.currentSeasonPlaylists || [];
    const activePlaylist = () => translations()[selectedTranslationIndex()]?.plist || [];
    const currentEpisode = () => activePlaylist()[currentEpisodeIndex()];
    const currentSeason = () => seasons()[selectedSeasonIndex()];
    const currentTranslationName = () => translations()[selectedTranslationIndex()]?.translation || '';
    const progressPct = () => progressPercent(currentTime(), duration());

    // ---- OSD / loader / controls visibility helpers ----

    /**
     * @param {string} icon
     * @param {string} text
     */
    function showOSD(icon, text, subtext = '') {
        setOsd({ visible: true, icon, text, subtext });
        clearTimeout(osdTimeout);
        osdTimeout = setTimeout(() => setOsd((prev) => ({ ...prev, visible: false })), 1200);
    }

    function resetControlsTimer() {
        if (isLocked()) return;
        setControlsVisible(true);
        clearTimeout(controlsTimeout);
        controlsTimeout = setTimeout(() => {
            if (video && !video.paused && !activePanel()) setControlsVisible(false);
        }, 3500);
    }

    function hideControls() {
        clearTimeout(controlsTimeout);
        setControlsVisible(false);
    }

    // ---- Watch progress (IndexedDB) ----

    /**
     * Stable series identity used as the watch-progress key. Prefers the
     * serial id parsed from the page, falling back to the series URL.
     */
    function seriesKey() {
        return payload()?.idSerial || seriesUrl;
    }

    /**
     * Flush the current playback position to IndexedDB. `force` bypasses the
     * `timeupdate` throttle (used on pause, episode switch, page hide, ...).
     */
    function persistProgress(force = false, episodeIndex = currentEpisodeIndex(), position = video?.currentTime || 0) {
        if (!progressReady || suppressPersist) return;
        const season = currentSeason();
        if (!season) return;
        const now = Date.now();
        if (!force && now - lastPersistedAt < PROGRESS_SAVE_INTERVAL_MS) return;
        lastPersistedAt = now;
        saveEpisodeProgress(seriesKey(), season.link, episodeIndex, position).catch(() => {});
    }

    /**
     * Remember the season currently being watched for the series.
     * @param {string} seasonLink
     */
    function persistSeriesProgress(seasonLink) {
        if (!seasonLink) return;
        saveSeriesProgress(seriesKey(), seasonLink).catch(() => {});
    }

    /**
     * Resume the current season from the last played episode/position. Falls
     * back to the first episode when no (valid) record exists.
     */
    async function restoreSeasonProgress() {
        const season = currentSeason();
        if (!season) {
            progressReady = true;
            return;
        }
        persistSeriesProgress(season.link);
        if (activePlaylist().length === 0) {
            progressReady = true;
            queueMicrotask(() => loadEpisode(0, true, 0));
            return;
        }
        let state = { episodeIndex: 0, position: 0 };
        try {
            const record = await loadSeasonProgress(seriesKey(), season.link);
            state = resolveResumeState(record, activePlaylist().length);
        } catch {
            // Ignore storage failures and start from the beginning.
        }
        suppressPersist = true;
        try {
            loadEpisode(state.episodeIndex, true, state.position);
        } finally {
            suppressPersist = false;
            progressReady = true;
        }
    }

    /**
     * Restore the last played season for a series (validated against the
     * freshly loaded season list) and resume it. Because the backend only
     * returns playlists for the fetched season, a different last-played season
     * is re-fetched via `changeSeason`.
     * @param {Series} series
     */
    async function restoreSeriesProgress(series) {
        const initialIndex = selectedSeasonIndex();
        let targetIndex = initialIndex;
        try {
            const record = await loadSeriesProgress(series.idSerial || seriesUrl);
            const savedLink = resolveResumeSeasonLink(record, series.seasons);
            if (savedLink) targetIndex = findSeasonIndexByLink(series.seasons, savedLink, initialIndex);
        } catch {
            // Ignore storage failures and resume the initially loaded season.
        }
        if (targetIndex !== initialIndex) await changeSeason(targetIndex);
        else await restoreSeasonProgress();
    }

    // ---- Playback ----

    /**
     * @param {number} epIdx
     */
    function loadEpisode(epIdx, autoPlay = true, startTime = 0) {
        const ep = activePlaylist()[epIdx];
        if (!ep || !ep.file || !video) return;
        // Persist the episode we are leaving before switching.
        if (epIdx !== currentEpisodeIndex()) persistProgress(true);
        setCurrentEpisodeIndex(epIdx);
        pendingSeek = startTime;
        switchingEpisode = true;
        video.src = ep.file;
        video.load();
        // Mark the newly loaded episode as the season's last played one.
        persistProgress(true, epIdx, startTime);
        if (autoPlay) startPlayback();
    }

    /**
     * Start playback, working around the browser autoplay policy.
     *
     * Browsers only allow unmuted autoplay once the user has interacted with
     * the page/domain. If the unmuted `play()` is rejected we fall back to
     * muted playback (always allowed) and show an "unmute" affordance; the
     * next user gesture then restores sound.
     */
    async function startPlayback() {
        if (!video) return;
        try {
            video.muted = false;
            await video.play();
            setNeedsUnmute(false);
        } catch (err) {
            if (err instanceof Error && shouldFallbackToMuted(err)) {
                try {
                    video.muted = true;
                    await video.play();
                    setNeedsUnmute(true);
                } catch {
                    setIsPlaying(false);
                }
            } else {
                setIsPlaying(false);
            }
        }
    }

    /** Restore sound on the first user gesture after a blocked autoplay. */
    function unlockAudio() {
        if (needsUnmute() && video) {
            video.muted = false;
            setNeedsUnmute(false);
        }
    }

    function togglePlayPause() {
        if (!video) return;
        if (video.paused || video.ended) startPlayback();
        else video.pause();
        resetControlsTimer();
    }

    function playPrevEpisode() {
        if (currentEpisodeIndex() > 0) loadEpisode(currentEpisodeIndex() - 1, true, 0);
        else showOSD('fa-step-backward', 'First Episode');
    }

    function playNextEpisode() {
        if (currentEpisodeIndex() < activePlaylist().length - 1) loadEpisode(currentEpisodeIndex() + 1, true, 0);
        else showOSD('fa-step-forward', 'End of Playlist');
    }

    function toggleFullscreen() {
        if (!document.fullscreenElement) playerContainer?.requestFullscreen?.();
        else document.exitFullscreen?.();
    }

    // ---- Panels ----

    /**
     * @param {string} name
     */
    function openPanel(name) {
        setActivePanel(name);
        resetControlsTimer();
    }

    function closePanels() {
        setActivePanel(null);
        resetControlsTimer();
    }

    /**
     * @param {string} name
     */
    function togglePanel(name) {
        if (activePanel() === name) closePanels();
        else openPanel(name);
    }

    // ---- Seasons / translations ----

    /**
     * @param {number} newIndex
     */
    async function changeSeason(newIndex) {
        const index = Number(newIndex);
        if (index === selectedSeasonIndex()) return;
        const target = seasons()[index];
        if (!target) return;

        setLoader({ visible: true, title: `Loading ${cleanTitle(target.title)}...`, subtitle: 'Fetching playlist' });
        persistProgress(true);
        try {
            const series = await fetchSeries(target.link);
            setPayload(series);
            setSelectedSeasonIndex(findSeasonIndexByLink(series.seasons, target.link, findCurrentSeasonIndex(series.seasons, index)));
            setSelectedTranslationIndex(0);
            setCurrentEpisodeIndex(0);
            await restoreSeasonProgress();
        } catch {
            showOSD('fa-triangle-exclamation', 'Failed to load', 'Season');
        } finally {
            setLoader((prev) => ({ ...prev, visible: false }));
        }
    }

    /**
     * @param {number} newIndex
     */
    function selectTranslation(newIndex) {
        const index = Number(newIndex);
        if (index === selectedTranslationIndex()) return;
        const resumeTime = video?.currentTime || 0;
        setSelectedTranslationIndex(index);
        const list = translations()[index]?.plist || [];
        const epIdx = clampEpisodeIndex(currentEpisodeIndex(), list.length);
        loadEpisode(epIdx, video ? !video.paused : true, resumeTime);
    }

    // ---- Lock ----

    function lockScreen() {
        setIsLocked(true);
        closePanels();
        setControlsVisible(false);
        showOSD('fa-lock', 'Screen Locked');
    }

    function unlockScreen() {
        setIsLocked(false);
        setControlsVisible(true);
        resetControlsTimer();
        showOSD('fa-lock-open', 'Screen Unlocked');
    }

    function onGestureClick() {
        const action = resolveTapAction({
            panelOpen: Boolean(activePanel()),
            locked: isLocked(),
            controlsVisible: controlsVisible(),
        });
        if (action === TAP_ACTIONS.CLOSE_PANEL) closePanels();
        else if (action === TAP_ACTIONS.SHOW_CONTROLS) resetControlsTimer();
        else if (action === TAP_ACTIONS.HIDE_CONTROLS) hideControls();
    }

    // ---- Video events ----

    function onLoadedMetadata() {
        if (!video) return;
        switchingEpisode = false;
        setDuration(video.duration || 0);
        if (pendingSeek > 0) {
            video.currentTime = pendingSeek;
            pendingSeek = 0;
        }
    }

    function onTimeUpdate() {
        if (!video) return;
        setCurrentTime(video.currentTime || 0);
        persistProgress(false);
    }

    /**
     * @param {{ currentTarget: { value: any; }; }} event
     */
    function onSeekInput(event) {
        if (!video || !(duration() > 0)) return;
        const pct = Number(event.currentTarget.value);
        video.currentTime = seekTimeFromPercent(pct, duration());
        setCurrentTime(video.currentTime);
    }

    // ---- Init ----

    onMount(async () => {
        // Keyboard shortcuts
        const onKeyDown = (/** @type {KeyboardEvent} */ event) => {
            if (isLocked() || !video) return;
            switch (resolveKeyAction(event.key)) {
                case KEY_ACTIONS.TOGGLE_PLAY:
                    togglePlayPause();
                    break;
                case KEY_ACTIONS.FULLSCREEN:
                    toggleFullscreen();
                    break;
                case KEY_ACTIONS.NEXT:
                    playNextEpisode();
                    break;
                case KEY_ACTIONS.PREV:
                    playPrevEpisode();
                    break;
                case KEY_ACTIONS.SEEK_BACK:
                    video.currentTime = Math.max(0, video.currentTime - SEEK_STEP_SECONDS);
                    showOSD('fa-backward', `-${SEEK_STEP_SECONDS}s`);
                    resetControlsTimer();
                    break;
                case KEY_ACTIONS.SEEK_FORWARD:
                    video.currentTime = Math.min(video.duration || 0, video.currentTime + SEEK_STEP_SECONDS);
                    showOSD('fa-forward', `+${SEEK_STEP_SECONDS}s`);
                    resetControlsTimer();
                    break;
                case KEY_ACTIONS.VOLUME_UP:
                    video.volume = Math.min(1, video.volume + VOLUME_STEP);
                    showOSD('fa-volume-high', `${Math.round(video.volume * 100)}%`);
                    break;
                case KEY_ACTIONS.VOLUME_DOWN:
                    video.volume = Math.max(0, video.volume - VOLUME_STEP);
                    showOSD('fa-volume-low', `${Math.round(video.volume * 100)}%`);
                    break;
            }
        };

        // Fullscreen state
        const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));

        // Persist when the page is backgrounded/closed.
        const onPageHide = () => persistProgress(true);
        const onVisibilityChange = () => {
            if (document.hidden) persistProgress(true);
        };

        // Touch gestures (left = brightness, right = volume, horizontal = seek)
        let activeSide = /** @type {'left' | 'right' | null} */ (null);
        let startX = 0;
        let startY = 0;
        let startVal = 0;
        let swiping = false;
        let gestureState = resetGestureState();

        const onTouchStart = (/** @type {TouchEvent} */ event) => {
            if (isLocked() || !playerContainer) return;
            // When a panel is open (or the touch starts inside a horizontally
            // scrollable panel), let the panel handle the gesture instead of
            // seeking / changing volume or brightness.
            if (activePanel() || (event.target instanceof Element && event.target.closest('.custom-scrollbar'))) return;
            const touch = event.touches[0];
            const rect = playerContainer.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            startX = touch.clientX;
            startY = touch.clientY;
            swiping = true;
            gestureState = resetGestureState();
            if (x < rect.width / 2) {
                activeSide = 'left';
                startVal = brightness();
            } else {
                activeSide = 'right';
                startVal = video?.volume ?? 1;
            }
        };

        const onTouchMove = (/** @type {TouchEvent} */ event) => {
            if (!swiping || isLocked() || activePanel() || !video || !playerContainer) return;
            const touch = event.touches[0];

            const result = resolveGesture(gestureState, {
                locked: isLocked(),
                panelOpen: Boolean(activePanel()),
                startedInScroller: false,
                side: activeSide,
                startValue: startVal,
                startX,
                startY,
                currentX: touch.clientX,
                currentY: touch.clientY,
                width: playerContainer.clientWidth,
                currentTime: video.currentTime,
                duration: video.duration || 0,
            });
            gestureState = result.state;

            if (result.type === GESTURE_TYPES.SEEK) {
                video.currentTime = result.time;
                const sign = result.delta >= 0 ? '+' : '';
                showOSD('fa-arrow-right-arrow-left', formatTime(result.time), `${sign}${Math.round(result.delta)}s`);
            } else if (result.type === GESTURE_TYPES.BRIGHTNESS) {
                setBrightness(result.value);
                showOSD('fa-sun', `${result.percent}%`, 'Brightness');
            } else if (result.type === GESTURE_TYPES.VOLUME) {
                video.volume = result.value;
                showOSD(result.icon, `${result.percent}%`, 'Volume');
            }
        };

        const onTouchEnd = () => {
            swiping = false;
            gestureState = resetGestureState();
            activeSide = null;
        };

        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('pointerdown', unlockAudio);
        document.addEventListener('keydown', unlockAudio);
        document.addEventListener('fullscreenchange', onFullscreenChange);
        document.addEventListener('visibilitychange', onVisibilityChange);
        window.addEventListener('pagehide', onPageHide);
        playerContainer?.addEventListener('touchstart', onTouchStart, { passive: true });
        playerContainer?.addEventListener('touchmove', onTouchMove, { passive: true });
        playerContainer?.addEventListener('touchend', onTouchEnd);
        playerContainer?.addEventListener('mousemove', resetControlsTimer);

        onCleanup(() => {
            document.removeEventListener('keydown', onKeyDown);
            document.removeEventListener('pointerdown', unlockAudio);
            document.removeEventListener('keydown', unlockAudio);
            document.removeEventListener('fullscreenchange', onFullscreenChange);
            document.removeEventListener('visibilitychange', onVisibilityChange);
            window.removeEventListener('pagehide', onPageHide);
            persistProgress(true);
            playerContainer?.removeEventListener('touchstart', onTouchStart);
            playerContainer?.removeEventListener('touchmove', onTouchMove);
            playerContainer?.removeEventListener('touchend', onTouchEnd);
            playerContainer?.removeEventListener('mousemove', resetControlsTimer);
            clearTimeout(controlsTimeout);
            clearTimeout(osdTimeout);
        });

        // Initial data load
        if (!seriesUrl) {
            setError('Series URL is required');
            return;
        }
        try {
            // The details page may pass the last played season so we can load
            // its episodes directly instead of the season the link opened on.
            let requestedUrl = seasonParam || seriesUrl;
            let series;
            try {
                series = await fetchSeries(requestedUrl);
            } catch (err) {
                if (requestedUrl === seriesUrl) throw err;
                requestedUrl = seriesUrl;
                series = await fetchSeries(requestedUrl);
            }
            setPayload(series);
            setSelectedSeasonIndex(
                findSeasonIndexByLink(series.seasons, requestedUrl, findCurrentSeasonIndex(series.seasons, 0))
            );
            setSelectedTranslationIndex(0);
            setCurrentEpisodeIndex(0);
            await restoreSeriesProgress(series);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            resetControlsTimer();
        }
    });

    return (
        <div class="h-screen w-screen overflow-hidden flex flex-col justify-center items-center bg-black text-white select-none touch-manipulation">
            <div
                ref={playerContainer}
                class="relative w-full h-full max-w-6xl max-h-[90vh] bg-black overflow-hidden flex items-center justify-center shadow-2xl group"
            >
                {/* HTML5 Video Element */}
                <video
                    ref={video}
                    class="w-full h-full object-contain"
                    playsinline
                    preload="auto"
                    onTimeUpdate={onTimeUpdate}
                    onLoadedMetadata={onLoadedMetadata}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => {
                        setIsPlaying(false);
                        if (!switchingEpisode) persistProgress(true);
                    }}
                    onEnded={() => {
                        setIsPlaying(false);
                        playNextEpisode();
                    }}
                >
                    Your browser does not support HTML5 video.
                </video>

                {/* Simulated Screen Brightness Overlay */}
                <div
                    id="brightness-overlay"
                    class="absolute inset-0 z-10"
                    style={{ 'background-color': brightnessOverlayColor(brightness()) }}
                />

                {/* Gesture Layer */}
                <div class="absolute inset-0 z-20 flex" onClick={onGestureClick}>
                    <div class="w-1/2 h-full cursor-pointer" />
                    <div class="w-1/2 h-full cursor-pointer" />
                </div>

                {/* Autoplay policy fallback: muted playback + tap to enable sound */}
                <Show when={needsUnmute()}>
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            unlockAudio();
                        }}
                        class="absolute left-1/2 -translate-x-1/2 top-16 z-40 flex items-center gap-2 bg-black/75 hover:bg-black/90 text-white text-xs font-semibold px-3.5 py-2 rounded-full border border-white/20 shadow-lg backdrop-blur-sm"
                    >
                        <i class="fa-solid fa-volume-xmark text-blue-400"></i>
                        <span>Включить звук</span>
                    </button>
                </Show>

                {/* Center OSD */}
                <div
                    class="absolute z-30 pointer-events-none transform transition-all duration-200 flex flex-col items-center justify-center"
                    classList={{ 'opacity-0 scale-95': !osd().visible, 'opacity-100 scale-100': osd().visible }}
                >
                    <div class="osd-box rounded-2xl px-8 py-5 flex flex-col items-center justify-center shadow-2xl">
                        <i class={`fa-solid ${osd().icon} text-4xl mb-2 text-white`}></i>
                        <span class="text-3xl font-extrabold tracking-wider text-white">{osd().text}</span>
                        <span
                            class="text-xs text-gray-300 mt-1 uppercase tracking-widest"
                            classList={{ hidden: !osd().subtext }}
                        >
                            {osd().subtext}
                        </span>
                    </div>
                </div>

                {/* Loading Overlay */}
                <div
                    class="absolute inset-0 z-40 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center space-y-4 transition-opacity duration-300"
                    classList={{ 'opacity-0 pointer-events-none': !loader().visible }}
                >
                    <div class="relative w-16 h-16 flex items-center justify-center">
                        <div class="absolute w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                        <i class="fa-solid fa-play text-blue-400 text-xl"></i>
                    </div>
                    <div class="text-center">
                        <p class="text-lg font-semibold text-white">{loader().title || 'Loading Season...'}</p>
                        <p class="text-xs text-gray-400 mt-1">{loader().subtitle || 'Fetching episode list'}</p>
                    </div>
                </div>

                {/* Error screen */}
                <Show when={error()}>
                    <div class="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center gap-4 text-center p-6">
                        <i class="fa-solid fa-triangle-exclamation text-4xl text-red-400"></i>
                        <p class="text-sm text-gray-200">{error()}</p>
                        <A href="/" class="text-blue-400 hover:text-blue-300 text-sm font-semibold">← Назад к поиску</A>
                    </div>
                </Show>

                {/* Floating Unlock Button */}
                <Show when={isLocked()}>
                    <button
                        type="button"
                        onClick={unlockScreen}
                        class="absolute left-6 top-1/2 -translate-y-1/2 z-50 bg-black/60 hover:bg-black/80 text-white p-4 rounded-full border border-white/20 shadow-lg"
                    >
                        <i class="fa-solid fa-lock text-xl text-blue-400"></i>
                    </button>
                </Show>

                {/* MX Player style control overlays */}
                <div
                    class="control-fade absolute inset-0 z-30 flex flex-col justify-between bg-gradient-to-b from-black/80 via-transparent to-black/90 p-4 sm:p-6"
                    classList={{ 'opacity-0 pointer-events-none': !controlsVisible() || isLocked() }}
                >
                    {/* Top Navigation Bar */}
                    <div class="flex items-center justify-between w-full">
                        <div class="flex items-center space-x-4">
                            <A
                                href={`/series-details?url=${encodeURIComponent(seriesUrl)}`}
                                class="text-white hover:text-blue-400 p-2 transition-colors"
                            >
                                <i class="fa-solid fa-arrow-left text-xl sm:text-2xl"></i>
                            </A>
                            <div class="flex flex-col">
                                <h1 class="text-sm sm:text-base font-semibold truncate max-w-[180px] sm:max-w-md text-gray-100">
                                    {currentEpisode()?.title || '—'}
                                </h1>
                                <span class="text-xs text-gray-400">
                                    {cleanTitle(currentSeason()?.title)} • {currentTranslationName()}
                                </span>
                            </div>
                        </div>

                        <div class="flex items-center space-x-3 sm:space-x-4 text-sm sm:text-base">
                            <button
                                type="button"
                                class="hover:text-blue-400 text-gray-200 p-1.5 transition-colors"
                                title="Toggle Orientation"
                                onClick={() => showOSD('fa-rotate', 'Screen Rotated')}
                            >
                                <i class="fa-solid fa-rotate text-lg"></i>
                            </button>

                            <button
                                type="button"
                                class="hover:text-blue-400 text-gray-200 p-1.5 transition-colors"
                                title="Seasons"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    togglePanel('seasons');
                                }}
                            >
                                <i class="fa-solid fa-layer-group text-lg"></i>
                            </button>

                            <button
                                type="button"
                                class="hover:text-blue-400 text-gray-200 p-1.5 transition-colors"
                                title="Translations"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    togglePanel('translations');
                                }}
                            >
                                <i class="fa-solid fa-music text-lg"></i>
                            </button>
                        </div>
                    </div>

                    {/* Center Panels */}
                    <div class="flex-1 w-full min-h-0 flex flex-col justify-center pointer-events-none">
                        {/* Episodes Panel */}
                        <div
                            class="w-full pointer-events-auto"
                            classList={{ hidden: activePanel() !== 'episodes' }}
                        >
                            <div class="flex items-center justify-between mb-2 px-1">
                                <h3 class="text-xs sm:text-sm font-bold uppercase tracking-widest text-gray-300 drop-shadow">Episodes</h3>
                                <div class="flex items-center space-x-2">
                                    <span class="text-[10px] text-blue-400 font-semibold">{activePlaylist().length} available</span>
                                    <button type="button" class="text-gray-400 hover:text-white p-0.5 transition-colors" title="Close" onClick={closePanels}>
                                        <i class="fa-solid fa-xmark"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="flex items-stretch gap-3 overflow-x-auto custom-scrollbar pb-2">
                                <For each={activePlaylist()}>
                                    {(ep, index) => {
                                        const playing = () => index() === currentEpisodeIndex();
                                        return (
                                            <div
                                                class="flex-shrink-0 w-40 sm:w-52 cursor-pointer group/ep"
                                                onClick={() => {
                                                    loadEpisode(index(), true, 0);
                                                    closePanels();
                                                }}
                                            >
                                                <div
                                                    class="relative h-24 sm:h-28 rounded-xl overflow-hidden border transition-all flex items-center justify-center"
                                                    classList={{
                                                        'border-blue-500/70 bg-blue-600/25': playing(),
                                                        'border-white/10 bg-black/30 group-hover/ep:bg-white/10 group-hover/ep:border-white/25': !playing(),
                                                    }}
                                                >
                                                    <i
                                                        class={`fa-solid ${playing() ? 'fa-circle-play text-blue-400' : 'fa-film text-gray-400'} text-3xl`}
                                                    ></i>
                                                    <span class="absolute top-1 left-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/60 text-gray-200">
                                                        E{index() + 1}
                                                    </span>
                                                    <Show when={playing()}>
                                                        <span class="absolute bottom-1 right-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-600 text-white">
                                                            Playing
                                                        </span>
                                                    </Show>
                                                </div>
                                                <p
                                                    class="text-xs font-semibold truncate mt-1.5"
                                                    classList={{ 'text-blue-300': playing(), 'text-gray-200': !playing() }}
                                                >
                                                    {ep.title}
                                                </p>
                                            </div>
                                        );
                                    }}
                                </For>
                                <Show when={activePlaylist().length === 0}>
                                    <div class="text-xs text-gray-400 py-4">No episodes found for this translation.</div>
                                </Show>
                            </div>
                        </div>

                        {/* Translations Panel */}
                        <div
                            class="w-full pointer-events-auto"
                            classList={{ hidden: activePanel() !== 'translations' }}
                        >
                            <div class="flex items-center justify-between mb-2 px-1">
                                <h3 class="text-xs sm:text-sm font-bold uppercase tracking-widest text-gray-300 drop-shadow">Translations</h3>
                                <div class="flex items-center space-x-2">
                                    <span class="text-[10px] text-blue-400 font-semibold">{translations().length} available</span>
                                    <button type="button" class="text-gray-400 hover:text-white p-0.5 transition-colors" title="Close" onClick={closePanels}>
                                        <i class="fa-solid fa-xmark"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="flex items-stretch gap-3 overflow-x-auto custom-scrollbar pb-2">
                                <For each={translations()}>
                                    {(trans, index) => {
                                        const active = () => index() === selectedTranslationIndex();
                                        return (
                                            <div
                                                class="flex-shrink-0 w-36 sm:w-44 p-3 rounded-xl border transition-all cursor-pointer backdrop-blur-sm"
                                                classList={{
                                                    'bg-blue-600/30 border-blue-500/60 text-white': active(),
                                                    'bg-black/30 border-white/10 text-gray-200 hover:bg-white/10 hover:border-white/20': !active(),
                                                }}
                                                onClick={() => selectTranslation(index())}
                                            >
                                                <div class="flex items-center justify-between mb-2">
                                                    <i class={`fa-solid ${active() ? 'fa-circle-check text-blue-400' : 'fa-language text-gray-400'}`}></i>
                                                    <span class="text-[10px] text-gray-400">{trans.plist.length} eps</span>
                                                </div>
                                                <p class="text-xs font-semibold truncate text-gray-100">{trans.translation}</p>
                                            </div>
                                        );
                                    }}
                                </For>
                                <Show when={translations().length === 0}>
                                    <div class="text-xs text-gray-400 py-4">No translations found.</div>
                                </Show>
                            </div>
                        </div>

                        {/* Seasons Panel */}
                        <div
                            class="w-full pointer-events-auto"
                            classList={{ hidden: activePanel() !== 'seasons' }}
                        >
                            <div class="flex items-center justify-between mb-2 px-1">
                                <h3 class="text-xs sm:text-sm font-bold uppercase tracking-widest text-gray-300 drop-shadow">Seasons</h3>
                                <div class="flex items-center space-x-2">
                                    <span class="text-[10px] text-blue-400 font-semibold">{seasons().length} seasons</span>
                                    <button type="button" class="text-gray-400 hover:text-white p-0.5 transition-colors" title="Close" onClick={closePanels}>
                                        <i class="fa-solid fa-xmark"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="flex items-stretch gap-3 overflow-x-auto custom-scrollbar pb-2">
                                <For each={seasons()}>
                                    {(season, index) => {
                                        const active = () => index() === selectedSeasonIndex();
                                        const epCount = () => (active() ? episodeCount(translations()) : 0);
                                        return (
                                            <div
                                                class="flex-shrink-0 w-36 sm:w-44 p-3 rounded-xl border transition-all cursor-pointer backdrop-blur-sm"
                                                classList={{
                                                    'bg-blue-600/30 border-blue-500/60 text-white': active(),
                                                    'bg-black/30 border-white/10 text-gray-200 hover:bg-white/10 hover:border-white/20': !active(),
                                                }}
                                                onClick={() => changeSeason(index())}
                                            >
                                                <div class="flex items-center justify-between mb-2">
                                                    <i class={`fa-solid ${active() ? 'fa-circle-play text-blue-400' : 'fa-layer-group text-gray-400'}`}></i>
                                                    <span class="text-[10px] text-gray-400">{active() ? 'Now' : ''}</span>
                                                </div>
                                                <p class="text-xs font-semibold truncate text-gray-100">{cleanTitle(season.title)}</p>
                                                <p class="text-[10px] text-gray-400 mt-0.5">
                                                    {epCount() > 0 ? `${epCount()} episodes` : 'Tap to load'}
                                                </p>
                                            </div>
                                        );
                                    }}
                                </For>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Section */}
                    <div class="w-full flex flex-col space-y-2 sm:space-y-4">
                        {/* Seek Bar Row */}
                        <div class="flex items-center space-x-3 text-xs sm:text-sm font-mono text-gray-300">
                            <span class="w-12 text-right">{formatTime(currentTime())}</span>
                            <div class="relative flex-1 flex items-center">
                                <div
                                    class="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-blue-500 rounded-l pointer-events-none z-0"
                                    style={{ width: `${progressPct()}%` }}
                                />
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="0.1"
                                    class="mx-progress z-10 relative"
                                    value={progressPct()}
                                    onInput={onSeekInput}
                                />
                            </div>
                            <span class="w-12 text-left">{formatTime(duration())}</span>
                        </div>

                        {/* Playback Action Bar */}
                        <div class="flex items-center justify-between px-2 sm:px-8 py-1">
                            <button
                                type="button"
                                class="text-gray-300 hover:text-white p-2 transition-colors"
                                title="Lock Controls"
                                onClick={lockScreen}
                            >
                                <i class="fa-solid fa-lock-open text-lg sm:text-xl"></i>
                            </button>

                            <div class="flex items-center space-x-6 sm:space-x-10">
                                <button type="button" class="text-gray-200 hover:text-blue-400 p-2 transition-colors" title="Previous Episode" onClick={playPrevEpisode}>
                                    <i class="fa-solid fa-step-backward text-xl sm:text-2xl"></i>
                                </button>

                                <button
                                    type="button"
                                    class="text-white hover:text-blue-400 p-3 transition-colors transform active:scale-95"
                                    title="Play / Pause"
                                    onClick={togglePlayPause}
                                >
                                    <i class={`fa-solid ${isPlaying() ? 'fa-pause' : 'fa-play'} text-2xl sm:text-3xl`}></i>
                                </button>

                                <button type="button" class="text-gray-200 hover:text-blue-400 p-2 transition-colors" title="Next Episode" onClick={playNextEpisode}>
                                    <i class="fa-solid fa-step-forward text-xl sm:text-2xl"></i>
                                </button>
                            </div>

                            <div class="flex items-center space-x-3">
                                <button
                                    type="button"
                                    class="text-gray-300 hover:text-blue-400 p-2 transition-colors relative"
                                    title="Episodes"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        togglePanel('episodes');
                                    }}
                                >
                                    <i class="fa-solid fa-list-ul text-lg sm:text-xl"></i>
                                </button>
                                <button
                                    type="button"
                                    class="text-gray-300 hover:text-white p-2 transition-colors"
                                    title="Toggle Fullscreen"
                                    onClick={toggleFullscreen}
                                >
                                    <i class={`fa-solid ${isFullscreen() ? 'fa-compress' : 'fa-expand'} text-lg sm:text-xl`}></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

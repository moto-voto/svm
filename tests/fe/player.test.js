import test from 'node:test';
import assert from 'node:assert/strict';

import {
    progressPercent,
    seekTimeFromPercent,
    shouldFallbackToMuted,
    findCurrentSeasonIndex,
    clampEpisodeIndex,
    episodeCount,
    brightnessOverlayColor,
    nextDecoderMode,
    resolveTapAction,
    TAP_ACTIONS,
    resolveKeyAction,
    KEY_ACTIONS,
    SEEK_STEP_SECONDS,
    VOLUME_STEP,
} from '../../src/ui/player.js';

test('progressPercent', () => {
    assert.equal(progressPercent(50, 100), 50);
    assert.equal(progressPercent(33, 100), 33);
    assert.equal(progressPercent(0, 100), 0);
    assert.equal(progressPercent(10, 0), 0);
    assert.equal(progressPercent(10, -1), 0);
});

test('seekTimeFromPercent', () => {
    assert.equal(seekTimeFromPercent(50, 100), 50);
    assert.equal(seekTimeFromPercent(0, 100), 0);
    assert.equal(seekTimeFromPercent(25, 200), 50);
    assert.equal(seekTimeFromPercent(100, 100), 100);
});

test('shouldFallbackToMuted only for NotAllowedError', () => {
    assert.equal(shouldFallbackToMuted({ name: 'NotAllowedError' }), true);
    assert.equal(shouldFallbackToMuted({ name: 'AbortError' }), false);
    assert.equal(shouldFallbackToMuted(new Error('boom')), false);
    assert.equal(shouldFallbackToMuted(null), false);
    assert.equal(shouldFallbackToMuted(undefined), false);
});

test('findCurrentSeasonIndex finds the current season or uses the fallback', () => {
    const seasons = [{ isCurrent: false }, { isCurrent: true }, { isCurrent: false }];
    assert.equal(findCurrentSeasonIndex(seasons), 1);
    assert.equal(findCurrentSeasonIndex([{ isCurrent: false }]), 0);
    assert.equal(findCurrentSeasonIndex([{ isCurrent: false }], 2), 2);
    assert.equal(findCurrentSeasonIndex([], 0), 0);
    assert.equal(findCurrentSeasonIndex(undefined), 0);
});

test('clampEpisodeIndex resets to 0 when out of range', () => {
    assert.equal(clampEpisodeIndex(0, 3), 0);
    assert.equal(clampEpisodeIndex(2, 3), 2);
    assert.equal(clampEpisodeIndex(3, 3), 0);
    assert.equal(clampEpisodeIndex(5, 3), 0);
    assert.equal(clampEpisodeIndex(0, 0), 0);
});

test('episodeCount sums episodes across translations', () => {
    assert.equal(episodeCount([]), 0);
    assert.equal(episodeCount([{ plist: [1, 2] }, { plist: [3] }]), 3);
    assert.equal(episodeCount([{ plist: null }, { plist: [1] }]), 1);
    assert.equal(episodeCount(undefined), 0);
});

test('brightnessOverlayColor inverts brightness into an overlay alpha', () => {
    assert.equal(brightnessOverlayColor(1), 'rgba(0, 0, 0, 0)');
    assert.equal(brightnessOverlayColor(0.5), 'rgba(0, 0, 0, 0.5)');
    assert.equal(brightnessOverlayColor(0.2), 'rgba(0, 0, 0, 0.8)');
});

test('nextDecoderMode flips between HW and SW', () => {
    assert.equal(nextDecoderMode('HW'), 'SW');
    assert.equal(nextDecoderMode('SW'), 'HW');
});

test('resolveTapAction prioritises the open panel, then lock state', () => {
    assert.equal(
        resolveTapAction({ panelOpen: true, locked: false, controlsVisible: true }),
        TAP_ACTIONS.CLOSE_PANEL
    );
    assert.equal(
        resolveTapAction({ panelOpen: true, locked: true, controlsVisible: true }),
        TAP_ACTIONS.CLOSE_PANEL
    );
    assert.equal(
        resolveTapAction({ panelOpen: false, locked: true, controlsVisible: false }),
        TAP_ACTIONS.IGNORE
    );
    assert.equal(
        resolveTapAction({ panelOpen: false, locked: false, controlsVisible: false }),
        TAP_ACTIONS.SHOW_CONTROLS
    );
    assert.equal(
        resolveTapAction({ panelOpen: false, locked: false, controlsVisible: true }),
        TAP_ACTIONS.HIDE_CONTROLS
    );
});

test('resolveKeyAction maps shortcuts (case-insensitive)', () => {
    assert.equal(resolveKeyAction(' '), KEY_ACTIONS.TOGGLE_PLAY);
    assert.equal(resolveKeyAction('K'), KEY_ACTIONS.TOGGLE_PLAY);
    assert.equal(resolveKeyAction('f'), KEY_ACTIONS.FULLSCREEN);
    assert.equal(resolveKeyAction('N'), KEY_ACTIONS.NEXT);
    assert.equal(resolveKeyAction('p'), KEY_ACTIONS.PREV);
    assert.equal(resolveKeyAction('ArrowLeft'), KEY_ACTIONS.SEEK_BACK);
    assert.equal(resolveKeyAction('ArrowRight'), KEY_ACTIONS.SEEK_FORWARD);
    assert.equal(resolveKeyAction('ArrowUp'), KEY_ACTIONS.VOLUME_UP);
    assert.equal(resolveKeyAction('ArrowDown'), KEY_ACTIONS.VOLUME_DOWN);
    assert.equal(resolveKeyAction('z'), KEY_ACTIONS.NONE);
    assert.equal(resolveKeyAction(undefined), KEY_ACTIONS.NONE);
});

test('keyboard step constants are sane', () => {
    assert.equal(SEEK_STEP_SECONDS, 5);
    assert.equal(VOLUME_STEP, 0.1);
});
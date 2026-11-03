import test from 'node:test';
import assert from 'node:assert/strict';

import {
    resolveGesture,
    resetGestureState,
    isHorizontalGesture,
    isVerticalGesture,
    seekDelta,
    volumeIconFor,
    GESTURE_TYPES,
    SEEK_THRESHOLD_PX,
    VERTICAL_THRESHOLD_PX,
} from '../../src/ui/gestures.js';

/**
 * Build a resolveGesture input with sane defaults.
 * @param {Record<string, unknown>} overrides
 */
function input(overrides = {}) {
    return {
        locked: false,
        panelOpen: false,
        startedInScroller: false,
        side: 'left',
        startValue: 1,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
        width: 100,
        currentTime: 30,
        duration: 100,
        ...overrides,
    };
}

test('resetGestureState returns a fresh, undecided state', () => {
    assert.deepEqual(resetGestureState(), { type: GESTURE_TYPES.IGNORE, seekStart: 0 });
});

test('isHorizontalGesture requires sideways travel beyond the threshold', () => {
    assert.equal(isHorizontalGesture(21, 20), true);
    assert.equal(isHorizontalGesture(30, 29), true);
    assert.equal(isHorizontalGesture(SEEK_THRESHOLD_PX, SEEK_THRESHOLD_PX), false);
    assert.equal(isHorizontalGesture(10, 5), false); // below threshold
    assert.equal(isHorizontalGesture(5, 30), false); // vertical wins
});

test('isVerticalGesture requires up/down travel beyond the lock threshold', () => {
    assert.equal(isVerticalGesture(5, 30), true);
    assert.equal(isVerticalGesture(30, 30), true); // exact 45 degrees counts as vertical
    assert.equal(isVerticalGesture(0, VERTICAL_THRESHOLD_PX + 1), true);
    assert.equal(isVerticalGesture(0, VERTICAL_THRESHOLD_PX), false); // at threshold, not beyond
    assert.equal(isVerticalGesture(0, 5), false); // below threshold
    assert.equal(isVerticalGesture(30, 29), false); // horizontal wins
});

test('a locked player ignores gestures', () => {
    const result = resolveGesture(resetGestureState(), input({ locked: true, currentX: 50 }));
    assert.equal(result.type, GESTURE_TYPES.IGNORE);
});

test('an open panel ignores gestures (regression: panel scroll must not seek)', () => {
    const result = resolveGesture(resetGestureState(), input({ panelOpen: true, currentX: 80, currentY: 0 }));
    assert.equal(result.type, GESTURE_TYPES.IGNORE);
});

test('a touch starting inside a scroller ignores gestures', () => {
    const result = resolveGesture(resetGestureState(), input({ startedInScroller: true, currentX: 80 }));
    assert.equal(result.type, GESTURE_TYPES.IGNORE);
});

test('a drag below both lock thresholds stays undecided (no accidental seek/volume)', () => {
    const horizontal = resolveGesture(resetGestureState(), input({ side: 'left', currentX: 10, currentY: 0 }));
    assert.equal(horizontal.type, GESTURE_TYPES.IGNORE);
    assert.deepEqual(horizontal.state, resetGestureState());

    const tinyVertical = resolveGesture(resetGestureState(), input({ side: 'right', currentX: 2, currentY: -5 }));
    assert.equal(tinyVertical.type, GESTURE_TYPES.IGNORE);
});

test('vertical drag on the left adjusts brightness', () => {
    // startValue 0.5, drag up 12px => +0.06
    const result = resolveGesture(
        resetGestureState(),
        input({ side: 'left', startValue: 0.5, currentX: 3, currentY: -12 })
    );
    assert.equal(result.type, GESTURE_TYPES.BRIGHTNESS);
    assert.ok(Math.abs(result.value - 0.56) < 1e-9);
    assert.equal(result.percent, 56);
});

test('vertical drag on the right adjusts volume', () => {
    const result = resolveGesture(
        resetGestureState(),
        input({ side: 'right', startValue: 0.5, currentX: 3, currentY: -20 })
    );
    assert.equal(result.type, GESTURE_TYPES.VOLUME);
    assert.ok(Math.abs(result.value - 0.6) < 1e-9);
    assert.equal(result.percent, 60);
    assert.equal(result.icon, 'fa-volume-high');
});

test('brightness is clamped to [0.2, 1]', () => {
    const low = resolveGesture(resetGestureState(), input({ side: 'left', startValue: 0.2, currentY: 100 }));
    assert.equal(low.value, 0.2);

    const high = resolveGesture(resetGestureState(), input({ side: 'left', startValue: 1, currentY: -100 }));
    assert.equal(high.value, 1);
});

test('volume is clamped to [0, 1]', () => {
    const low = resolveGesture(resetGestureState(), input({ side: 'right', startValue: 0, currentY: 100 }));
    assert.equal(low.value, 0);

    const high = resolveGesture(resetGestureState(), input({ side: 'right', startValue: 1, currentY: -100 }));
    assert.equal(high.value, 1);
});

test('a long horizontal drag seeks, on either side (regression: sideways drag must not change brightness/volume)', () => {
    const left = resolveGesture(
        resetGestureState(),
        input({ side: 'left', currentX: 60, currentY: 0, width: 100, currentTime: 30, duration: 100 })
    );
    assert.equal(left.type, GESTURE_TYPES.SEEK);
    assert.equal(left.delta, seekDelta(60, 100));
    assert.equal(left.time, 30 + seekDelta(60, 100)); // frozen at currentTime=30

    const right = resolveGesture(
        resetGestureState(),
        input({ side: 'right', currentX: -40, currentY: 0, width: 100, currentTime: 30, duration: 100 })
    );
    assert.equal(right.type, GESTURE_TYPES.SEEK);
    assert.equal(right.delta, seekDelta(-40, 100));
    assert.equal(right.time, 0); // clamped at the start of the video
});

test('seek drags are absolute: the base time freezes on the first qualifying move', () => {
    let state = resetGestureState();
    const first = resolveGesture(state, input({ currentX: 30, currentY: 0, currentTime: 30 }));
    assert.equal(first.type, GESTURE_TYPES.SEEK);
    assert.equal(first.time, 30 + seekDelta(30, 100));
    state = first.state;
    assert.equal(state.type, GESTURE_TYPES.SEEK);
    assert.equal(state.seekStart, 30);

    const second = resolveGesture(state, input({ currentX: 50, currentY: 0, currentTime: 999 }));
    assert.equal(second.type, GESTURE_TYPES.SEEK);
    assert.equal(second.time, 30 + seekDelta(50, 100)); // base not refrozen mid-drag
    assert.equal(second.state.seekStart, 30);
});

test('a locked vertical swipe cannot turn into a seek when the finger drifts sideways (regression)', () => {
    // Start a volume swipe (right side, drag up 30px) — locks to VOLUME.
    let state = resetGestureState();
    const first = resolveGesture(state, input({ side: 'right', startValue: 0.5, currentX: 0, currentY: -30 }));
    assert.equal(first.type, GESTURE_TYPES.VOLUME);
    assert.equal(first.state.type, GESTURE_TYPES.VOLUME);
    state = first.state;

    // The finger drifts to ~45+ degrees horizontal: |dx|=100 > |dy|=30 and
    // beyond the seek threshold — an unlocked gesture would switch to SEEK.
    const second = resolveGesture(state, input({ side: 'right', startValue: 0.5, currentX: 100, currentY: -30 }));
    assert.equal(second.type, GESTURE_TYPES.VOLUME);
    assert.equal(second.state.type, GESTURE_TYPES.VOLUME);
    // Still driven by the vertical travel only: 0.5 + 30 * 0.005 = 0.65.
    assert.ok(Math.abs(second.value - 0.65) < 1e-9);
    assert.equal(second.percent, 65);

    // Same for brightness on the left side.
    let bState = resetGestureState();
    const bFirst = resolveGesture(bState, input({ side: 'left', startValue: 0.5, currentX: 0, currentY: -30 }));
    assert.equal(bFirst.type, GESTURE_TYPES.BRIGHTNESS);
    const bSecond = resolveGesture(bFirst.state, input({ side: 'left', startValue: 0.5, currentX: -80, currentY: -30 }));
    assert.equal(bSecond.type, GESTURE_TYPES.BRIGHTNESS);
    assert.ok(Math.abs(bSecond.value - 0.65) < 1e-9);
});

test('a locked seek cannot turn into volume/brightness when the finger drifts vertically (regression)', () => {
    let state = resetGestureState();
    const first = resolveGesture(state, input({ side: 'right', currentX: 30, currentY: 0, currentTime: 30 }));
    assert.equal(first.type, GESTURE_TYPES.SEEK);
    state = first.state;

    // The finger drifts mostly vertical: |dy|=200 > |dx|=30 — an unlocked
    // gesture would switch to VOLUME.
    const second = resolveGesture(state, input({ side: 'right', currentX: 30, currentY: 200, currentTime: 999 }));
    assert.equal(second.type, GESTURE_TYPES.SEEK);
    assert.equal(second.state.type, GESTURE_TYPES.SEEK);
    // Still driven by the horizontal travel only, base frozen at 30.
    assert.equal(second.time, 30 + seekDelta(30, 100));
});

test('seekDelta scales with width', () => {
    assert.equal(seekDelta(50, 100), 45);
    assert.equal(seekDelta(100, 200), 45);
    assert.equal(seekDelta(0, 100), 0);
});

test('volumeIconFor maps percentages to icons', () => {
    assert.equal(volumeIconFor(0), 'fa-volume-mute');
    assert.equal(volumeIconFor(50), 'fa-volume-low');
    assert.equal(volumeIconFor(51), 'fa-volume-high');
    assert.equal(volumeIconFor(100), 'fa-volume-high');
});

test('resolveGesture does not mutate the input state', () => {
    const state = Object.freeze({ type: GESTURE_TYPES.IGNORE, seekStart: 0 });
    const result = resolveGesture(state, input({ side: 'right', currentY: -15 }));
    assert.equal(result.type, GESTURE_TYPES.VOLUME);
    assert.deepEqual(result.state, { type: GESTURE_TYPES.VOLUME, seekStart: 0 });
    assert.deepEqual(state, { type: GESTURE_TYPES.IGNORE, seekStart: 0 });
});
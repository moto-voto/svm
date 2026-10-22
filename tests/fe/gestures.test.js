import test from 'node:test';
import assert from 'node:assert/strict';

import {
    resolveGesture,
    resetGestureState,
    isHorizontalGesture,
    seekDelta,
    volumeIconFor,
    GESTURE_TYPES,
    SEEK_THRESHOLD_PX,
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

test('resetGestureState returns a fresh, non-horizontal state', () => {
    assert.deepEqual(resetGestureState(), { horizontal: false, seekStart: 0 });
});

test('isHorizontalGesture requires sideways travel beyond the threshold', () => {
    assert.equal(isHorizontalGesture(21, 20), true);
    assert.equal(isHorizontalGesture(30, 29), true);
    assert.equal(isHorizontalGesture(SEEK_THRESHOLD_PX, SEEK_THRESHOLD_PX), false);
    assert.equal(isHorizontalGesture(10, 5), false); // below threshold
    assert.equal(isHorizontalGesture(5, 30), false); // vertical wins
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

test('a small horizontal drag stays vertical (no accidental seek)', () => {
    const result = resolveGesture(resetGestureState(), input({ side: 'left', currentX: 10, currentY: 0 }));
    assert.equal(result.type, GESTURE_TYPES.BRIGHTNESS);
});

test('vertical drag on the left adjusts brightness', () => {
    // startValue 0.5, drag up 10px => +0.05
    const result = resolveGesture(
        resetGestureState(),
        input({ side: 'left', startValue: 0.5, currentX: 3, currentY: -10 })
    );
    assert.equal(result.type, GESTURE_TYPES.BRIGHTNESS);
    assert.ok(Math.abs(result.value - 0.55) < 1e-9);
    assert.equal(result.percent, 55);
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

test('a long horizontal drag seeks and snapshots the start time', () => {
    const result = resolveGesture(
        resetGestureState(),
        input({ side: 'left', currentX: 50, currentY: 0, width: 100, currentTime: 30, duration: 100 })
    );

    assert.equal(result.type, GESTURE_TYPES.SEEK);
    assert.equal(result.delta, 45); // (50 / 100) * 90
    assert.equal(result.time, 75); // 30 + 45
    assert.deepEqual(result.state, { horizontal: true, seekStart: 30 });
});

test('once horizontal, the gesture stays a seek even if the drag turns vertical', () => {
    const state = { horizontal: true, seekStart: 30 };
    const result = resolveGesture(
        state,
        input({ side: 'left', currentX: 5, currentY: -100, width: 100, duration: 100 })
    );
    assert.equal(result.type, GESTURE_TYPES.SEEK);
    assert.equal(result.state, state);
});

test('seek target is clamped to [0, duration]', () => {
    const back = resolveGesture(
        { horizontal: true, seekStart: 10 },
        input({ currentX: -50, width: 100, duration: 100 })
    );
    assert.equal(back.time, 0);

    const forward = resolveGesture(
        { horizontal: true, seekStart: 95 },
        input({ currentX: 50, width: 100, duration: 100 })
    );
    assert.equal(forward.time, 100);
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
    const state = Object.freeze({ horizontal: false, seekStart: 0 });
    const result = resolveGesture(state, input({ side: 'right', currentY: -10 }));
    assert.equal(result.type, GESTURE_TYPES.VOLUME);
    assert.deepEqual(result.state, { horizontal: false, seekStart: 0 });
    assert.deepEqual(state, { horizontal: false, seekStart: 0 });
});
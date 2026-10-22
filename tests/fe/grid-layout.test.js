import test from 'node:test';
import assert from 'node:assert/strict';

import {
    BUFFER_ROWS,
    ASPECT_RATIO,
    cardMetrics,
    computeLayout,
    computeVisibleIndices,
    positionFor,
    formatGridStats,
} from '../../src/ui/grid-layout.js';

test('cardMetrics picks breakpoints by window width', () => {
    assert.deepEqual(cardMetrics(1000), { minCardWidth: 165, gap: 18 });
    assert.deepEqual(cardMetrics(640), { minCardWidth: 165, gap: 18 });
    assert.deepEqual(cardMetrics(639), { minCardWidth: 145, gap: 14 });
    assert.deepEqual(cardMetrics(400), { minCardWidth: 145, gap: 14 });
    assert.deepEqual(cardMetrics(399), { minCardWidth: 125, gap: 10 });
});

test('computeLayout computes columns, sizes, rows and total height', () => {
    const layout = computeLayout({ total: 40, containerWidth: 776, windowWidth: 800 });

    assert.equal(layout.columns, 4);
    assert.equal(layout.gap, 18);
    assert.equal(layout.totalRows, 10);
    assert.equal(layout.cardWidth, 180.5);
    assert.ok(Math.abs(layout.cardHeight - 279.775) < 1e-9);
    assert.ok(Math.abs(layout.rowHeight - 297.775) < 1e-9);
    assert.ok(Math.abs(layout.totalHeight - 2959.75) < 1e-9);
});

test('computeLayout is empty/zeroed for an empty dataset', () => {
    const layout = computeLayout({ total: 0, containerWidth: 776, windowWidth: 800 });

    assert.equal(layout.total, 0);
    assert.equal(layout.totalRows, 0);
    assert.equal(layout.totalHeight, 0);
    // Columns still resolve so the container keeps a sane width.
    assert.equal(layout.columns, 4);
});

test('computeLayout never goes below one column', () => {
    const layout = computeLayout({ total: 3, containerWidth: 50, windowWidth: 320 });
    assert.equal(layout.columns, 1);
    assert.equal(layout.cardWidth, 50);
});

test('computeVisibleIndices returns [] for an empty dataset', () => {
    const layout = computeLayout({ total: 0, containerWidth: 776, windowWidth: 800 });
    const indices = computeVisibleIndices({ layout, scrollY: 0, containerTop: 0, windowHeight: 800 });
    assert.deepEqual(indices, []);
});

test('computeVisibleIndices windows rows around the viewport (top)', () => {
    const layout = computeLayout({ total: 40, containerWidth: 776, windowWidth: 800 });
    const indices = computeVisibleIndices({
        layout,
        scrollY: 0,
        containerTop: 0,
        windowHeight: 800,
    });

    // rows 0..5 with 4 columns => items 0..23
    assert.equal(indices[0], 0);
    assert.equal(indices.at(-1), 23);
    assert.equal(indices.length, 24);
    assert.equal(BUFFER_ROWS, 2);
});

test('computeVisibleIndices windows rows after scrolling', () => {
    const layout = computeLayout({ total: 40, containerWidth: 776, windowWidth: 800 });
    const indices = computeVisibleIndices({
        layout,
        scrollY: 3 * layout.rowHeight,
        containerTop: 0,
        windowHeight: 800,
    });

    // rows 1..8 with 4 columns => items 4..35
    assert.equal(indices[0], 4);
    assert.equal(indices.at(-1), 35);
});

test('computeVisibleIndices accounts for the container offset (sticky header)', () => {
    const layout = computeLayout({ total: 40, containerWidth: 776, windowWidth: 800 });
    const indices = computeVisibleIndices({
        layout,
        scrollY: 3 * layout.rowHeight,
        containerTop: layout.rowHeight,
        windowHeight: 800,
    });

    // scrolled = 2 rows => start row 0 => items 0..27
    assert.equal(indices[0], 0);
});

test('positionFor lays cards out on a grid', () => {
    const layout = computeLayout({ total: 40, containerWidth: 776, windowWidth: 800 });

    const first = positionFor(layout, 0);
    assert.equal(first.width, '180.5px');
    assert.ok(Math.abs(Number.parseFloat(first.height) - 279.775) < 1e-9);
    assert.equal(first.transform, 'translate3d(0px, 0px, 0)');

    const fourth = positionFor(layout, 3); // row 0, col 3
    assert.equal(fourth.transform, 'translate3d(595.5px, 0px, 0)');

    const fifth = positionFor(layout, 4); // row 1, col 0
    const y = Number(fifth.transform.match(/, ([\d.]+)px, 0\)/)?.[1]);
    assert.ok(Math.abs(y - layout.rowHeight) < 1e-9);
    assert.ok(fifth.transform.startsWith('translate3d(0px,'));
});

test('ASPECT_RATIO matches the poster ratio', () => {
    assert.ok(Math.abs(ASPECT_RATIO - 2 / 3.1) < 1e-12);
});

test('formatGridStats renders the empty state', () => {
    assert.equal(formatGridStats(0, 0), '0 / 0');
});

test('formatGridStats reports mounted vs total', () => {
    assert.equal(
        formatGridStats(24, 1000),
        `24 visible (${(1000).toLocaleString()} total)`
    );
});
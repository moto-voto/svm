import test from 'node:test';
import assert from 'node:assert/strict';

import {
    normalizeImageUrl,
    buildPosterFallback,
    formatSeasonsLabel,
    formatRating,
    RATING_FALLBACK,
    PLACEHOLDER_POSTER,
} from '../../src/ui/series-details.js';

test('normalizeImageUrl upgrades protocol-relative URLs', () => {
    assert.equal(normalizeImageUrl('//cdn.svstat.net/x.jpg'), 'https://cdn.svstat.net/x.jpg');
    assert.equal(normalizeImageUrl('https://cdn.svstat.net/x.jpg'), 'https://cdn.svstat.net/x.jpg');
    assert.equal(normalizeImageUrl('/relative/x.jpg'), '/relative/x.jpg');
});

test('normalizeImageUrl handles empty input', () => {
    assert.equal(normalizeImageUrl(''), '');
    assert.equal(normalizeImageUrl(null), '');
    assert.equal(normalizeImageUrl(undefined), '');
});

test('buildPosterFallback encodes the title', () => {
    assert.equal(
        buildPosterFallback('A B'),
        `${PLACEHOLDER_POSTER}?text=A%20B`
    );
    assert.equal(buildPosterFallback(undefined), `${PLACEHOLDER_POSTER}?text=Series`);
});

test('formatSeasonsLabel', () => {
    assert.equal(formatSeasonsLabel(3), '3 сезона');
    assert.equal(formatSeasonsLabel(0), '—');
    assert.equal(formatSeasonsLabel(null), '—');
});

test('formatRating falls back when missing', () => {
    assert.equal(formatRating('6.00'), '6.00');
    assert.equal(formatRating(0), RATING_FALLBACK);
    assert.equal(formatRating(''), RATING_FALLBACK);
    assert.equal(formatRating(null), RATING_FALLBACK);
    assert.equal(formatRating(undefined), RATING_FALLBACK);
});
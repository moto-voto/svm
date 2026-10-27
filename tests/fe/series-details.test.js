import test from 'node:test';
import assert from 'node:assert/strict';

import {
    normalizeImageUrl,
    buildPosterFallback,
    formatSeasonsLabel,
    formatRating,
    buildPlayerHref,
    resolveBackHref,
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

test('buildPlayerHref builds a player link with the series url', () => {
    assert.equal(
        buildPlayerHref('https://seasonvar.ru/serial-1.html'),
        '/series?url=https%3A%2F%2Fseasonvar.ru%2Fserial-1.html'
    );
});

test('buildPlayerHref appends the last played season when provided', () => {
    assert.equal(
        buildPlayerHref('https://seasonvar.ru/serial-1.html', 'https://seasonvar.ru/serial-1/2-season.html'),
        '/series?url=https%3A%2F%2Fseasonvar.ru%2Fserial-1.html&season=https%3A%2F%2Fseasonvar.ru%2Fserial-1%2F2-season.html'
    );
    assert.equal(buildPlayerHref('', ''), '/series?url=');
});

test('buildPlayerHref carries title and image metadata for the watch history', () => {
    assert.equal(
        buildPlayerHref('https://seasonvar.ru/serial-1.html', '', 'Игра престолов', 'https://x/p.jpg'),
        '/series?url=https%3A%2F%2Fseasonvar.ru%2Fserial-1.html' +
            '&title=%D0%98%D0%B3%D1%80%D0%B0%20%D0%BF%D1%80%D0%B5%D1%81%D1%82%D0%BE%D0%BB%D0%BE%D0%B2' +
            '&image=https%3A%2F%2Fx%2Fp.jpg'
    );
});

test('buildPlayerHref omits empty metadata', () => {
    assert.equal(
        buildPlayerHref('https://seasonvar.ru/serial-1.html', 's1', '', ''),
        '/series?url=https%3A%2F%2Fseasonvar.ru%2Fserial-1.html&season=s1'
    );
    assert.equal(
        buildPlayerHref('https://seasonvar.ru/serial-1.html', undefined, '', undefined),
        '/series?url=https%3A%2F%2Fseasonvar.ru%2Fserial-1.html'
    );
});

test('buildPlayerHref carries the origin (from) through to the player', () => {
    assert.equal(
        buildPlayerHref('https://seasonvar.ru/serial-1.html', 's1', 'A', 'img', 'history'),
        '/series?url=https%3A%2F%2Fseasonvar.ru%2Fserial-1.html&season=s1&title=A&image=img&from=history'
    );
    assert.equal(
        buildPlayerHref('https://seasonvar.ru/serial-1.html', undefined, undefined, undefined, ''),
        '/series?url=https%3A%2F%2Fseasonvar.ru%2Fserial-1.html'
    );
});

test('resolveBackHref returns to the origin page', () => {
    assert.equal(resolveBackHref('history'), '/history');
    assert.equal(resolveBackHref('bookmarks'), '/bookmarks');
    assert.equal(resolveBackHref(''), '/');
    assert.equal(resolveBackHref(undefined), '/');
    assert.equal(resolveBackHref(null), '/');
    assert.equal(resolveBackHref('search'), '/');
});
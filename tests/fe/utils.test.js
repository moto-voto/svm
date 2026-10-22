import test from 'node:test';
import assert from 'node:assert/strict';

import { cleanTitle, formatTime, clamp, normalizeQuery } from '../../src/ui/utils.js';

test('cleanTitle trims and strips a trailing dangling parenthesis', () => {
    assert.equal(cleanTitle('  Season 1 (  '), 'Season 1');
    assert.equal(cleanTitle('Season 2 ('), 'Season 2');
    assert.equal(cleanTitle('Season 3'), 'Season 3');
});

test('clamp keeps values in range', () => {
    assert.equal(clamp(5, 0, 10), 5);
    assert.equal(clamp(-1, 0, 10), 0);
    assert.equal(clamp(11, 0, 10), 10);
    assert.equal(clamp(0.3, 0.2, 1), 0.3);
});

test('normalizeQuery trims and tolerates empty input', () => {
    assert.equal(normalizeQuery('  hello  '), 'hello');
    assert.equal(normalizeQuery(''), '');
    assert.equal(normalizeQuery(null), '');
    assert.equal(normalizeQuery(undefined), '');
});

test('cleanTitle tolerates empty / missing input', () => {
    assert.equal(cleanTitle(''), '');
    assert.equal(cleanTitle(undefined), '');
    assert.equal(cleanTitle(null), '');
});

test('formatTime renders MM:SS under an hour', () => {
    assert.equal(formatTime(0), '00:00');
    assert.equal(formatTime(5), '00:05');
    assert.equal(formatTime(65), '01:05');
    assert.equal(formatTime(3599), '59:59');
});

test('formatTime renders HH:MM:SS past an hour', () => {
    assert.equal(formatTime(3600), '01:00:00');
    assert.equal(formatTime(3661), '01:01:01');
    assert.equal(formatTime(86399), '23:59:59');
});

test('formatTime handles invalid input', () => {
    assert.equal(formatTime(NaN), '00:00');
    assert.equal(formatTime(Infinity), '00:00');
});
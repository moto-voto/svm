import test from 'node:test';
import assert from 'node:assert/strict';

import { cleanTitle, formatTime } from '../../src/ui/utils.js';

test('cleanTitle trims and strips a trailing dangling parenthesis', () => {
    assert.equal(cleanTitle('  Season 1 (  '), 'Season 1');
    assert.equal(cleanTitle('Season 2 ('), 'Season 2');
    assert.equal(cleanTitle('Season 3'), 'Season 3');
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
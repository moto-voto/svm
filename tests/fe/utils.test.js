import test from 'node:test';
import assert from 'node:assert/strict';

import {
    cleanTitle,
    formatTime,
    clamp,
    normalizeQuery,
    withBase,
    joinBase,
    basePathFromScriptUrl,
    BASE_PATH,
    BASE_URL,
} from '../../src/ui/utils.js';

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

test('BASE_PATH/BASE_URL default to the root outside a browser', () => {
    assert.equal(BASE_PATH, '');
    assert.equal(BASE_URL, '/');
});

test('basePathFromScriptUrl detects the deployment prefix', () => {
    assert.equal(basePathFromScriptUrl('https://host/svm/assets/index-abc.js'), '/svm/');
    assert.equal(basePathFromScriptUrl('https://host/svm/nested/assets/index.js'), '/svm/nested/');
    assert.equal(basePathFromScriptUrl('https://host/assets/index-abc.js'), '/');
    assert.equal(basePathFromScriptUrl('https://host/svm/assets/index.js?v=1#x'), '/svm/');
    // Vite dev server module paths.
    assert.equal(basePathFromScriptUrl('http://localhost:5173/src/ui/utils.js'), '/');
    assert.equal(basePathFromScriptUrl('http://localhost:5173/svm/src/ui/utils.js'), '/svm/');
    assert.equal(basePathFromScriptUrl('http://localhost:5173/svm/src/ui/pages/x.js'), '/svm/');
    // A prefix that itself contains "src"/"assets" is preserved.
    assert.equal(basePathFromScriptUrl('http://localhost:5173/assets/src/ui/x.js'), '/assets/');
    assert.equal(basePathFromScriptUrl('https://host/src/assets/index.js'), '/src/');
    // Assets emitted without a dedicated assets dir still resolve sensibly.
    assert.equal(basePathFromScriptUrl('https://host/svm/index-abc.js'), '/svm/');
});

test('joinBase composes base and app paths', () => {
    assert.equal(joinBase('', '/api/search?q=a'), '/api/search?q=a');
    assert.equal(joinBase('', 'api/search'), '/api/search');
    assert.equal(joinBase('/svm', '/api/search?q=a'), '/svm/api/search?q=a');
    assert.equal(joinBase('/svm', 'series'), '/svm/series');
    assert.equal(joinBase('/svm/', '/series-details'), '/svm/series-details');
    assert.equal(joinBase('/svm', ''), '/svm');
    assert.equal(joinBase('', ''), '/');
});

test('withBase prefixes app paths with the detected deployment base', () => {
    assert.equal(withBase('/api/search?q=a'), '/api/search?q=a');
    assert.equal(withBase('api/search?q=a'), '/api/search?q=a');
    assert.equal(withBase('/series-details'), '/series-details');
    assert.equal(withBase(''), '/');
    assert.equal(withBase(undefined), '/');
});
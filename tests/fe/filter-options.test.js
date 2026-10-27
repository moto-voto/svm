import test from 'node:test';
import assert from 'node:assert/strict';

import {
    GENRES,
    COUNTRIES,
    SORT_OPTIONS,
    ALL_VALUE,
    DEFAULT_SORT,
    normalizeFilterValue,
    normalizeSortValue,
    buildFilterApiQuery,
} from '../../src/ui/filter-options.js';

test('GENRES starts with the all option and carries ids as values', () => {
    assert.equal(GENRES[0].value, 'all');
    assert.equal(GENRES[0].label, 'Любой жанр');
    assert.deepEqual(
        GENRES.find((g) => g.value === '19'),
        { value: '19', label: 'Discovery&BBC' }
    );
    assert.deepEqual(
        GENRES.find((g) => g.value === '3'),
        { value: '3', label: 'фэнтези' }
    );
    // Every id (except "all") is numeric, every label non-empty.
    for (const g of GENRES.slice(1)) {
        assert.match(g.value, /^\d+$/);
        assert.ok(g.label.length > 0);
    }
});

test('COUNTRIES starts with the all option and mirrors value/text', () => {
    assert.equal(COUNTRIES[0].value, 'all');
    assert.equal(COUNTRIES[0].label, 'Любая страна');
    assert.deepEqual(
        COUNTRIES.find((c) => c.value === 'США'),
        { value: 'США', label: 'США' }
    );
    assert.deepEqual(
        COUNTRIES.find((c) => c.value === 'Япония'),
        { value: 'Япония', label: 'Япония' }
    );
    // The legacy latin-a variant is preserved next to the cyrillic one.
    assert.ok(COUNTRIES.some((c) => c.value === 'Мексикa' && c.label === 'Мексикa'));
    assert.ok(COUNTRIES.some((c) => c.value === 'Мексика' && c.label === 'Мексика'));
    assert.ok(COUNTRIES.length > 100);
});

test('normalizeFilterValue defaults to all', () => {
    assert.equal(normalizeFilterValue('19'), '19');
    assert.equal(normalizeFilterValue('all'), 'all');
    assert.equal(normalizeFilterValue(''), 'all');
    assert.equal(normalizeFilterValue('  '), 'all');
    assert.equal(normalizeFilterValue(null), 'all');
    assert.equal(normalizeFilterValue(undefined), 'all');
    assert.equal(normalizeFilterValue(' США '), 'США');
});

test('SORT_OPTIONS carries backend values and the default first', () => {
    assert.equal(DEFAULT_SORT, 'name');
    assert.deepEqual(SORT_OPTIONS[0], { value: 'name', label: 'По названию' });
    assert.deepEqual(
        SORT_OPTIONS.map((o) => o.value),
        ['name', 'kinopoisk', 'imdb', 'god', 'view', 'newest']
    );
    assert.deepEqual(
        SORT_OPTIONS.find((o) => o.value === 'imdb'),
        { value: 'imdb', label: 'По imdb' }
    );
});

test('normalizeSortValue defaults to name', () => {
    assert.equal(normalizeSortValue('view'), 'view');
    assert.equal(normalizeSortValue('name'), 'name');
    assert.equal(normalizeSortValue(''), 'name');
    assert.equal(normalizeSortValue('  '), 'name');
    assert.equal(normalizeSortValue(null), 'name');
    assert.equal(normalizeSortValue(undefined), 'name');
});

test('buildFilterApiQuery omits all values', () => {
    assert.equal(buildFilterApiQuery('all', 'all', 'name'), '');
    assert.equal(buildFilterApiQuery('', '', ''), '');
    assert.equal(buildFilterApiQuery(null, undefined, undefined), '');
});

test('buildFilterApiQuery encodes genre and country alone and together', () => {
    assert.equal(buildFilterApiQuery('19', 'all'), '?filter_quotG=19');
    assert.equal(buildFilterApiQuery('all', 'США'), '?filter_quotC=%D0%A1%D0%A8%D0%90');
    assert.equal(
        buildFilterApiQuery('19', 'США'),
        '?filter_quotG=19&filter_quotC=%D0%A1%D0%A8%D0%90'
    );
    assert.equal(buildFilterApiQuery('7', 'Россия'), '?filter_quotG=7&filter_quotC=%D0%A0%D0%BE%D1%81%D1%81%D0%B8%D1%8F');
});

test('buildFilterApiQuery appends the sort option only when non-default', () => {
    assert.equal(buildFilterApiQuery('all', 'all', 'imdb'), '?filter_sortTo=imdb');
    assert.equal(buildFilterApiQuery('all', 'all', 'name'), '');
    assert.equal(
        buildFilterApiQuery('19', 'США', 'god'),
        '?filter_quotG=19&filter_quotC=%D0%A1%D0%A8%D0%90&filter_sortTo=god'
    );
    assert.equal(
        buildFilterApiQuery('all', 'США', 'view'),
        '?filter_quotC=%D0%A1%D0%A8%D0%90&filter_sortTo=view'
    );
});

test('per-dimension filters keep the other dimension in the URL', () => {
    // Genre set, country reset -> only genre is sent.
    assert.equal(buildFilterApiQuery('9', 'all'), '?filter_quotG=9');
});
import test from 'node:test';
import assert from 'node:assert/strict';

import { TARGET } from '../../src/common.js';
import { apiSearch } from '../../src/api/api-search.js';
import { apiSeries } from '../../src/api/api-series.js';
import { apiSeriesDetails } from '../../src/api/api-series-details.js';
import { apiSeriesList } from '../../src/api/api-series-list.js';
import { apiPlaylist } from '../../src/api/api-playlist.js';
import { installFetch } from './fetch-mock.js';
import * as fixtures from './fixtures.js';

test('apiSearch(query) hits the search endpoint and parses results', async () => {
    const fetchMock = installFetch([{ match: '/search?', body: fixtures.searchHtml }]);
    try {
        const results = await apiSearch('matrix');

        assert.equal(results.length, 2);
        assert.equal(results[0].title, 'Test Show');
        assert.equal(fetchMock.calls[0].url, `${TARGET}/search?q=matrix`);
        // Request carries the shared Seasonvar headers.
        assert.ok(fetchMock.calls[0].options.headers['User-Agent']);
    } finally {
        fetchMock.restore();
    }
});

test('apiSearch("") falls back to the default list', async () => {
    const fetchMock = installFetch([{ match: TARGET, body: fixtures.defaultListHtml }]);
    try {
        const results = await apiSearch('');

        assert.equal(results.length, 2);
        assert.equal(results[0].id, '43004');
        assert.equal(fetchMock.calls[0].url, TARGET);
    } finally {
        fetchMock.restore();
    }
});

test('apiSeries(url) requires a url and parses seasons', async () => {
    await assert.rejects(() => apiSeries(''), /Series URL is required/);

    const url = `${TARGET}/serial-1.html`;
    const fetchMock = installFetch([{ match: 'serial-1.html', body: fixtures.seriesSimpleHtml }]);
    try {
        const series = await apiSeries(url);
        assert.equal(series.seasons.length, 2);
        assert.equal(fetchMock.calls[0].url, url);
    } finally {
        fetchMock.restore();
    }
});

test('apiSeriesDetails(url) requires a url and parses details', async () => {
    await assert.rejects(() => apiSeriesDetails(''), /Series URL is required/);

    const url = `${TARGET}/serial-1.html`;
    const fetchMock = installFetch([{ match: 'serial-1.html', body: fixtures.seriesDetailsHtml }]);
    try {
        const details = await apiSeriesDetails(url);
        assert.equal(details.title, 'Test Series (не)Пара');
        assert.equal(fetchMock.calls[0].url, url);
    } finally {
        fetchMock.restore();
    }
});

test('apiSeriesList() fetches the target page and parses the default list', async () => {
    const fetchMock = installFetch([{ match: TARGET, body: fixtures.defaultListHtml }]);
    try {
        const series = await apiSeriesList();
        assert.equal(series.length, 2);
        assert.equal(fetchMock.calls[0].url, TARGET);
    } finally {
        fetchMock.restore();
    }
});

test('apiPlaylist(url) requires a url and parses translations', async () => {
    await assert.rejects(() => apiPlaylist(''), /Series URL is required/);

    const { html, routes } = fixtures.playlistAssignmentOnly();
    const url = `${TARGET}/serial-1.html`;
    const fetchMock = installFetch([
        { match: 'serial-1.html', body: html },
        { match: '/plist/only.json', body: routes[`${TARGET}/plist/only.json`] },
    ]);
    try {
        const translations = await apiPlaylist(url);
        assert.equal(translations.length, 1);
        assert.equal(translations[0].translation, 'Default');
    } finally {
        fetchMock.restore();
    }
});
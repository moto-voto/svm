import test from 'node:test';
import assert from 'node:assert/strict';

import { searchSeries, fetchSeries, fetchSeriesDetails, filterSeries, clearApiCache } from '../../src/ui/api.js';
import { installFetch } from './fetch-mock.js';

test('searchSeries encodes the query and returns the array', async () => {
    const fetchMock = installFetch([
        { match: '/api/search', body: [{ title: 'A', fullLink: 'x', image: null, description: null }] },
    ]);
    try {
        const results = await searchSeries('big show');

        assert.equal(results.length, 1);
        assert.equal(results[0].title, 'A');
        assert.equal(fetchMock.calls[0].url, '/api/search?q=big%20show');
    } finally {
        fetchMock.restore();
        clearApiCache();
    }
});

test('searchSeries throws on a non-ok response', async () => {
    const fetchMock = installFetch([{ match: '/api/search', body: {}, status: 500, statusText: 'Boom' }]);
    try {
        await assert.rejects(() => searchSeries('x'), /HTTP 500 Boom/);
    } finally {
        fetchMock.restore();
        clearApiCache();
    }
});

test('searchSeries surfaces a server error payload', async () => {
    const fetchMock = installFetch([{ match: '/api/search', body: { error: 'nope' } }]);
    try {
        await assert.rejects(() => searchSeries('x'), /nope/);
    } finally {
        fetchMock.restore();
        clearApiCache();
    }
});

test('searchSeries rejects an unexpected (non-array) payload', async () => {
    const fetchMock = installFetch([{ match: '/api/search', body: { foo: 1 } }]);
    try {
        await assert.rejects(() => searchSeries('x'), /Unexpected response from server/);
    } finally {
        fetchMock.restore();
        clearApiCache();
    }
});

test('filterSeries sends genre/country and returns the array', async () => {
    const fetchMock = installFetch([
        {
            match: '/api/series-filter',
            body: [{ id: '1', title: 'A', fullLink: 'x', image: null, description: null }],
        },
    ]);
    try {
        const results = await filterSeries('19', 'США');
        assert.equal(results.length, 1);
        assert.equal(results[0].title, 'A');
        assert.equal(
            fetchMock.calls[0].url,
            '/api/series-filter?filter_quotG=19&filter_quotC=%D0%A1%D0%A8%D0%90'
        );
    } finally {
        fetchMock.restore();
        clearApiCache();
    }
});

test('filterSeries forwards the sort option', async () => {
    const fetchMock = installFetch([{ match: '/api/series-filter', body: [] }]);
    try {
        await filterSeries('19', 'США', 'imdb');
        assert.equal(
            fetchMock.calls[0].url,
            '/api/series-filter?filter_quotG=19&filter_quotC=%D0%A1%D0%A8%D0%90&filter_sortTo=imdb'
        );
    } finally {
        fetchMock.restore();
        clearApiCache();
    }
});

test('filterSeries omits all values (whole-catalog listing)', async () => {
    const fetchMock = installFetch([{ match: '/api/series-filter', body: [] }]);
    try {
        const results = await filterSeries('all', 'all');
        assert.deepEqual(results, []);
        assert.equal(fetchMock.calls[0].url, '/api/series-filter');
    } finally {
        fetchMock.restore();
        clearApiCache();
    }
});

test('filterSeries sends only the non-all dimension', async () => {
    const fetchMock = installFetch([{ match: '/api/series-filter', body: [] }]);
    try {
        await filterSeries('7', 'all');
        assert.equal(fetchMock.calls[0].url, '/api/series-filter?filter_quotG=7');
    } finally {
        fetchMock.restore();
        clearApiCache();
    }
});

test('filterSeries surfaces server errors and rejects non-array payloads', async () => {
    const bad = installFetch([{ match: '/api/series-filter', body: { error: 'nope' } }]);
    try {
        await assert.rejects(() => filterSeries('19', 'all'), /nope/);
    } finally {
        bad.restore();
        clearApiCache();
    }

    const weird = installFetch([{ match: '/api/series-filter', body: { foo: 1 } }]);
    try {
        await assert.rejects(() => filterSeries('19', 'all'), /Unexpected response from server/);
    } finally {
        weird.restore();
        clearApiCache();
    }
});

test('fetchSeries encodes the url and returns the series', async () => {
    const series = { seasons: [], currentSeasonPlaylists: [] };
    const fetchMock = installFetch([{ match: '/api/series', body: series }]);
    try {
        const result = await fetchSeries('https://seasonvar.ru/a b.html');
        assert.deepEqual(result, series);
        assert.equal(
            fetchMock.calls[0].url,
            '/api/series?url=https%3A%2F%2Fseasonvar.ru%2Fa%20b.html'
        );
    } finally {
        fetchMock.restore();
        clearApiCache();
    }
});

test('fetchSeries throws when the payload carries an error', async () => {
    const fetchMock = installFetch([{ match: '/api/series', body: { error: 'bad series' } }]);
    try {
        await assert.rejects(() => fetchSeries('u'), /bad series/);
    } finally {
        fetchMock.restore();
        clearApiCache();
    }
});

test('fetchSeriesDetails returns details and propagates errors', async () => {
    const good = installFetch([{ match: '/api/series-details', body: { id: '1', title: 'T' } }]);
    try {
        const details = await fetchSeriesDetails('https://x/y');
        assert.equal(details.id, '1');
    } finally {
        good.restore();
        clearApiCache();
    }

    const bad = installFetch([{ match: '/api/series-details', body: { error: 'no details' } }]);
    try {
        await assert.rejects(() => fetchSeriesDetails('u'), /no details/);
    } finally {
        bad.restore();
        clearApiCache();
    }
});

test('fetchSeriesDetails throws on a non-ok response', async () => {
    const fetchMock = installFetch([
        { match: '/api/series-details', body: {}, status: 404, statusText: 'Not Found' },
    ]);
    try {
        await assert.rejects(() => fetchSeriesDetails('u'), /HTTP 404 Not Found/);
    } finally {
        fetchMock.restore();
        clearApiCache();
    }
});
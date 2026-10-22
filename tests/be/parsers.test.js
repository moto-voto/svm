import test from 'node:test';
import assert from 'node:assert/strict';

import { TARGET } from '../../src/common.js';
import { parseSearchResults } from '../../src/parser/search.js';
import { parseDefaultList } from '../../src/parser/defaultList.js';
import { parseSeriesDetails } from '../../src/parser/series-details.js';
import { parseSeries } from '../../src/parser/series.js';
import { parsePlaylistTranslations, fetchPlaylist } from '../../src/parser/playlists.js';
import { installFetch } from './fetch-mock.js';
import * as fixtures from './fixtures.js';

test('parseSearchResults extracts id-less search hits', () => {
    const results = parseSearchResults(fixtures.searchHtml, TARGET);

    assert.equal(results.length, 2);

    assert.deepEqual(results[0], {
        id: '1',
        title: 'Test Show',
        fullLink: `${TARGET}/serial-1-test.html`,
        image: 'https://cdn.svstat.net/oblojka/1.jpg',
        description: 'A description',
    });

    assert.equal(results[1].title, 'Second');
    assert.equal(results[1].fullLink, 'https://other.example/x.html');
    assert.equal(results[1].image, 'https://img.example/x.jpg');
    assert.equal(results[1].description, null);
});

test('parseDefaultList builds image URLs and descriptions', () => {
    const results = parseDefaultList(fixtures.defaultListHtml, TARGET);

    assert.equal(results.length, 2);

    assert.deepEqual(results[0], {
        id: '43004',
        title: 'Series Title',
        fullLink: `${TARGET}/serial-43004-nePara-3-season.html`,
        image: 'https://cdn.svstat.net/oblojka/43004.jpg',
        description: '(3 сезон)\n1-8 серия',
    });

    // Second entry has no season/episode info.
    assert.equal(results[1].id, '43005');
    assert.equal(results[1].description, null);
    assert.equal(results[1].fullLink, 'https://seasonvar.ru/serial-43005-other.html');
});

test('parseSeriesDetails extracts every field', () => {
    const details = parseSeriesDetails(fixtures.seriesDetailsHtml);

    assert.deepEqual(details, {
        id: '43004-season',
        title: 'Test Series (не)Пара',
        fullLink: 'https://seasonvar.ru/serial-43004-test.html',
        image: '//cdn.svstat.net/oblojka/43004.jpg',
        description: 'A test description',
        year: '2024',
        country: 'США',
        genre: 'комедия, мелодрамы',
        imdb: '6.00',
        kinopoisk: '7.24',
        originalName: 'Mismatched',
        seasons: 2,
    });
});

test('parseSeriesDetails returns nulls/empty for a bare document', () => {
    const details = parseSeriesDetails('<html><body></body></html>');

    assert.equal(details.id, '');
    assert.equal(details.title, '');
    assert.equal(details.fullLink, '');
    assert.equal(details.image, '');
    assert.equal(details.description, null);
    assert.equal(details.year, null);
    assert.equal(details.imdb, null);
    assert.equal(details.kinopoisk, null);
    assert.equal(details.originalName, null);
    assert.equal(details.seasons, null);
});

test('parseSeries extracts seasons and cleans titles/dates', async () => {
    const series = await parseSeries(fixtures.seriesSimpleHtml, TARGET);

    assert.deepEqual(series.seasons, [
        { title: 'Сезон 1', link: `${TARGET}/s1.html`, isCurrent: true },
        { title: 'Сезон 2', link: `${TARGET}/s2.html`, isCurrent: false },
    ]);
    assert.deepEqual(series.currentSeasonPlaylists, []);
});

test('parseSeries loads translations/playlists', async () => {
    const { html, routes } = fixtures.seriesWithTranslations();
    const fetchMock = installFetch([
        { match: '/plist/0.json', body: routes[`${TARGET}/plist/0.json`] },
        { match: '/plist/1.json', body: routes[`${TARGET}/plist/1.json`] },
    ]);
    try {
        const series = await parseSeries(html, TARGET);

        assert.equal(series.seasons.length, 1);
        assert.equal(series.seasons[0].isCurrent, true);

        assert.equal(series.currentSeasonPlaylists.length, 2);
        assert.deepEqual(series.currentSeasonPlaylists[0], {
            translation: 'Дубляж',
            plist: [{ title: 'Episode 1 - Pilot', file: 'https://example.com/e1.mp4' }],
        });
        assert.equal(series.currentSeasonPlaylists[1].translation, 'Субтитры');
        assert.equal(series.currentSeasonPlaylists[1].plist[0].file, 'https://example.com/f1.mp4');
    } finally {
        fetchMock.restore();
    }
});

test('parsePlaylistTranslations supports the pl[id] assignment form + fallback', async () => {
    const { html, routes } = fixtures.playlistAssignmentOnly();
    const fetchMock = installFetch([
        { match: '/plist/only.json', body: routes[`${TARGET}/plist/only.json`] },
    ]);
    try {
        const translations = await parsePlaylistTranslations(html);

        assert.equal(translations.length, 1);
        assert.equal(translations[0].translation, 'Default');
        assert.deepEqual(translations[0].plist, [
            { title: 'Only - One', file: 'https://example.com/only.mp4' },
        ]);
    } finally {
        fetchMock.restore();
    }
});

test('fetchPlaylist filters out non-http / undecodable entries', async () => {
    const { html, routes } = fixtures.playlistWithInvalidEntry();
    const fetchMock = installFetch([
        { match: '/plist/mixed.json', body: routes[`${TARGET}/plist/mixed.json`] },
    ]);
    try {
        const translations = await parsePlaylistTranslations(html);

        assert.equal(translations.length, 1);
        assert.deepEqual(translations[0].plist, [
            { title: 'Good', file: 'https://example.com/good.mp4' },
        ]);
    } finally {
        fetchMock.restore();
    }
});

test('fetchPlaylist returns [] when the payload is not an array', async () => {
    const fetchMock = installFetch([{ match: '/not-array.json', body: { nope: true } }]);
    try {
        const plist = await fetchPlaylist('/not-array.json');
        assert.deepEqual(plist, []);
    } finally {
        fetchMock.restore();
    }
});
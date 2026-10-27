import { withBase } from './utils.js';
import { createCachedApi } from './api-cache.js';
import { buildFilterApiQuery } from './filter-options.js';

/** @import { SerialDescription } from '../parser/search.js' */
/** @import { Series } from '../parser/series.js' */
/** @import { SeriesDetails } from '../parser/series-details.js' */

/**
 * Perform the actual GET request and resolve with the raw response body.
 * HTTP-level failures are normalized to thrown `Error`s with readable
 * messages. Response-body handling (JSON parsing and the `{error}` payload
 * convention) lives in the caching wrapper, see `api-cache.js`.
 * @param {string} url
 * @returns {Promise<string>}
 */
async function fetchText(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    return response.text();
}

// Data on the server is very stable (a few changes per hour at most), so every
// API call goes through a per-URL in-memory cache with a 10-minute TTL. The
// cache stores raw response strings, so each caller gets a freshly parsed
// object and can never mutate cached data.
let cachedApi = createCachedApi(fetchText);

/**
 * Fetch series from the backend search API.
 * @param {string} query
 * @returns {Promise<SerialDescription[]>}
 */
export async function searchSeries(query) {
    const data = await cachedApi(withBase(`/api/search?q=${encodeURIComponent(query)}`));
    if (!Array.isArray(data)) {
        throw new Error('Unexpected response from server');
    }
    return data;
}

/**
 * Fetch series filtered by genre and/or country (`/api/series-filter`). Pass
 * the ALL_VALUE ('all') to leave a dimension unconstrained, and the DEFAULT
 * SORT ('name') for the backend-default ordering.
 * @param {string} genre genre id ('all' when unset)
 * @param {string} country country name ('all' when unset)
 * @param {string} sort sort option ('name' when unset)
 * @returns {Promise<SerialDescription[]>}
 */
export async function filterSeries(genre, country, sort) {
    const query = buildFilterApiQuery(genre, country, sort);
    const data = await cachedApi(withBase(`/api/series-filter${query}`));
    if (!Array.isArray(data)) {
        throw new Error('Unexpected response from server');
    }
    return data;
}

/**
 * Fetch a series (seasons + current season playlists).
 * @param {string} url
 * @returns {Promise<Series>}
 */
export async function fetchSeries(url) {
    return cachedApi(withBase(`/api/series?url=${encodeURIComponent(url)}`));
}

/**
 * Fetch series details.
 * @param {string} url
 * @returns {Promise<SeriesDetails>}
 */
export async function fetchSeriesDetails(url) {
    return cachedApi(withBase(`/api/series-details?url=${encodeURIComponent(url)}`));
}

/**
 * Drop every cached response (used by unit tests; the cache is module-level
 * and would otherwise leak between tests in the same process).
 */
export function clearApiCache() {
    // Re-create the wrapper instead of reaching into its internals.
    cachedApi = createCachedApi(fetchText);
}

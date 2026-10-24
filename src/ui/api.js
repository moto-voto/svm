import { withBase } from './utils.js';

/** @import { SerialDescription } from '../parser/search.js' */
/** @import { Series } from '../parser/series.js' */
/** @import { SeriesDetails } from '../parser/series-details.js' */

/**
 * Fetch series from the backend search API.
 * @param {string} query
 * @returns {Promise<SerialDescription[]>}
 */
export async function searchSeries(query) {
    const response = await fetch(withBase(`/api/search?q=${encodeURIComponent(query)}`));
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    if (!Array.isArray(data)) {
        throw new Error(data?.error || 'Unexpected response from server');
    }
    return data;
}

/**
 * Fetch a series (seasons + current season playlists).
 * @param {string} url
 * @returns {Promise<Series>}
 */
export async function fetchSeries(url) {
    const response = await fetch(withBase(`/api/series?url=${encodeURIComponent(url)}`));
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    if (data?.error) {
        throw new Error(data.error);
    }
    return data;
}

/**
 * Fetch series details.
 * @param {string} url
 * @returns {Promise<SeriesDetails>}
 */
export async function fetchSeriesDetails(url) {
    const response = await fetch(withBase(`/api/series-details?url=${encodeURIComponent(url)}`));
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    if (data?.error) {
        throw new Error(data.error);
    }
    return data;
}

import { HEADERS, TARGET } from "../common.js";
import { parseSeriesDetails } from "../parser/series-details.js";
/** @import { SeriesDetails } from "../parser/series-details.js" */


/**
 * @param {string} url
 * @returns {Promise<SeriesDetails>}
 */
export async function apiSeriesDetails(url) {
    if (!url) {
        throw new Error('Series URL is required');
    }

    const response = await fetch(url, { headers: HEADERS });
    const htmlContent = await response.text();
    const series = parseSeriesDetails(htmlContent);
    return series;
}
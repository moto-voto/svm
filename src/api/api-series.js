import { HEADERS, TARGET } from "../common.js";
import { parseSeries } from "../parser/series.js";
/** @import { Series } from "../parser/series.js" */

/**
 * @param {string} seriesUrl
 * @returns {Promise<Series>}
 */
export async function apiSeries(seriesUrl) {
    if (!seriesUrl) {
        throw new Error('Series URL is required');
    }

    const response = await fetch(seriesUrl, { headers: HEADERS });
    const htmlContent = await response.text();
    const series = await parseSeries(htmlContent, TARGET);
    return series;
}
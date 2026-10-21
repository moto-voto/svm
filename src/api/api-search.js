import { HEADERS, TARGET } from '../common.js';
import { parseDefaultList } from '../parser/defaultList.js';
import { parseSearchResults } from '../parser/search.js';
/** @import { SerialDescription } from '../parser/search.js'; */

/**
 * @param {string} query
 * @returns {Promise<SerialDescription[]>}
 */
export async function apiSearch(query) {
    if (query) {
        const searchUrl = `${TARGET}/search?q=${encodeURIComponent(query)}`;
        const response = await fetch(searchUrl, { headers: HEADERS });
        const htmlContent = await response.text();
        const searchResult = parseSearchResults(htmlContent, TARGET);
        return searchResult;
    } else {
        const response = await fetch(TARGET, { headers: HEADERS });
        const htmlContent = await response.text();
        const searchResult = parseDefaultList(htmlContent, TARGET);
        return searchResult;
    }
}


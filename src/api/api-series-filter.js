import { HEADERS, TARGET } from '../common.js';
import { parseFilterResults } from '../parser/filter.js';
/** @import { SerialDescription } from '../parser/search.js'; */


/**
 * @typedef apiSeriesFilterParams
 * @property {string | undefined} filter_quotG Genre ID(s)
 * @property {string | undefined} filter_quotC Country code(s)
 * @property {string | undefined} filter_sortTo Sort option (name, quotG, quotC, etc.)
 * @property {string | undefined} filter_engName English name filter
 * @property {string | undefined} filter_only Additional filters
 * @property {string | undefined} filter_raiT Rating type (kp, etc.)
 * @property {string | undefined} filter_hd HD filter
 * @property {string | undefined} filter_fhd Full HD filter
 * @property {string | undefined} filter_sub Subtitles filter
 * @property {string | undefined} filter_block Blocked filter
 * @property {string | undefined} filter_history History filter
 * @property {string | undefined} filter_mark Rating mark
 * @property {string | undefined} filter_nw Network filter
 * @property {string | undefined} filter_exp Explorer filter
 */

/**
 * Search series using filter parameters: genre, country, etc.
 * Uses POST request with form data to seasonvar.ru.
 * 
 * @param {apiSeriesFilterParams} params
 * @returns {Promise<SerialDescription[]>}
 */
export async function apiSeriesFilter(params) {
    const {
        filter_quotG,
        filter_quotC,
        filter_sortTo,
        filter_engName,
        filter_only,
        filter_raiT,
        filter_hd,
        filter_fhd,
        filter_sub,
        filter_block,
        filter_history,
        filter_mark,
        filter_nw,
        filter_exp
    } = params;

    // Build form data
    const formData = new URLSearchParams();

    if (filter_quotG) {
        formData.append('filter[quotG][]', filter_quotG);
    }
    if (filter_quotC) {
        formData.append('filter[quotC][]', filter_quotC);
    }

    formData.append('filter[sortTo][]', filter_sortTo || 'name');
    formData.append('filter[engName]', filter_engName || '');
    formData.append('filter[only]', filter_only || '');
    formData.append('filter[rait]', filter_raiT || 'kp');
    formData.append('filter[hd]', filter_hd || '');
    formData.append('filter[fhd]', filter_fhd || '');
    formData.append('filter[sub]', filter_sub || '');
    formData.append('filter[block]', filter_block || '');
    formData.append('filter[history]', filter_history || '');
    formData.append('filter[mark]', filter_mark || '');
    formData.append('filter[nw]', filter_nw || '');
    formData.append('filter[exp]', filter_exp || '');
    formData.append('beforeSend', '');

    const searchUrl = `${TARGET}/index.php`;
    const response = await fetch(searchUrl, {
        method: 'POST',
        headers: {
            ...HEADERS,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
        },
        body: formData
    });
    const htmlContent = await response.text();
    
    // Parse filtered search results (alphabetical list format)
    const results = parseFilterResults(htmlContent, TARGET);
    
    return results;
}

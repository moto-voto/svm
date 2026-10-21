import { HEADERS, TARGET } from "../common.js";
import { parseDefaultList } from "../parser/defaultList.js";
/** @import { SerialDescription } from "../parser/search.js" */

/**
 * @returns {Promise<SerialDescription[]>}
 */
export async function apiSeriesList() {

    const response = await fetch(TARGET, { headers: HEADERS });
    const htmlContent = await response.text();
    const series = await parseDefaultList(htmlContent, TARGET);
    return series;
}
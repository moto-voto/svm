import { HEADERS } from "../common.js";
import { parsePlaylistTranslations } from "../parser/playlists.js";

/**
 * @param {string} seriesUrl
 */
export async function apiPlaylist(seriesUrl) {
    if (!seriesUrl) {
        throw new Error('Series URL is required');
    }

    const response = await fetch(seriesUrl, { headers: HEADERS });
    const htmlContent = await response.text();
    const playlists = await parsePlaylistTranslations(htmlContent);
    return playlists;
}



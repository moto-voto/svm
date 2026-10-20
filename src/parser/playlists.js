import { HEADERS, log } from "../common.js";

/**
 * @typedef {Object} PlayListItem
 * @property {string} title
 * @property {string | null} file
 */



/**
 * @param {string} htmlContent
 * @returns {Promise<PlayListItem[]>}
 */
export async function parsePlaylist(htmlContent) {
    /**
     * @type {PlayListItem[]}
     */
    let episodes = [];

    // Extract the `pl` variable containing the playlist path
    const plMatch = htmlContent.match(/var\s+pl\s*=\s*\{[^}]*['"]0['"]\s*:\s*['"]([^'"]+)['"]/);

    if (plMatch && plMatch[1]) {
        const playlistPath = plMatch[1];
        const playlistUrl = playlistPath.startsWith('http') ? playlistPath : `https://seasonvar.ru${playlistPath}`;

        log('log', `✅ [SERIAL DEBUG] Found playlist URL: ${playlistUrl}`);

        const playlistRes = await fetch(playlistUrl, { headers: HEADERS });
        const playlistData = await playlistRes.json();

        if (Array.isArray(playlistData)) {
            log('log', `📺 [SERIAL DEBUG] Found ${playlistData.length} episodes.`);
            episodes = playlistData.map((ep, index) => {
                const decodedFile = decodeSeasonvarLink(ep.file);
                return {
                    title: ep.title.replace(/<br\s*\/?>/gi, ' - ').replace(/\s+/g, ' ').trim(),
                    file: decodedFile
                };
            }).filter(ep => ep.file && ep.file.startsWith('http'));
        }
    } else {
        throw new Error('Could not find the playlist URL.');
    }
    return episodes;
}

// --- DECODER ---
/**
 * @param {string} encodedStr
 * @returns {string | null}
 */
function decodeSeasonvarLink(encodedStr) {
    try {
        let clean = encodedStr.replace(/^#\d/, '');
        clean = clean.replace(/\/\/b2xvbG8=/g, '').replace(/b2xvbG8=/g, '').replace(/b2xvbG8/g, '');
        while (clean.length % 4 !== 0) clean += '=';
        let decoded = Buffer.from(clean, 'base64').toString('utf8');
        decoded = decoded.replace(/ololo/g, '').replace(/[^\x20-\x7E]/g, '');
        if (decoded.startsWith('//')) decoded = 'https:' + decoded;
        return decoded.trim();
    } catch (err) {
        return null;
    }
}

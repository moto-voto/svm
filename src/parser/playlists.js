import { load } from "cheerio";
import { HEADERS } from "../common.js";

/**
 * @typedef {Object} PlayListItem
 * @property {string} title
 * @property {string | null} file
 */

/**
 * @typedef PlaylistTranslation
 * @property {string} translation
 * @property {PlayListItem[]} plist
 */

/**
 * @param {string} htmlString
 * @returns {Promise<PlaylistTranslation[]>}
 */
export async function parsePlaylistTranslations(htmlString) {
    const $ = load(htmlString);
    /** @type {Record<string, string>} */
    const plMap = {};

    // 1. Extract playlist URLs from all <script> tags
    $('script').each((_, el) => {
        const scriptContent = $(el).html();
        if (!scriptContent) return;

        // Match initial declaration: var pl = { ... };
        const varPlMatch = scriptContent.match(/var\s+pl\s*=\s*({[^;]+});/);
        if (varPlMatch) {
            try {
                const rawObjStr = varPlMatch[1].replace(/'/g, '"');
                const parsedObj = JSON.parse(rawObjStr);
                Object.assign(plMap, parsedObj);
            } catch (e) {
                // Fallback for single quotes or non-standard formatting
                const innerPlRegex = /['"]?(\d+)['"]?\s*:\s*['"]([^'"]+)['"]/g;
                let innerMatch;
                while ((innerMatch = innerPlRegex.exec(varPlMatch[1])) !== null) {
                    plMap[innerMatch[1]] = innerMatch[2];
                }
            }
        }

        // Match individual assignments: pl[id] = "..."
        const plAssignmentRegex = /pl\[['"]?(\w+)['"]?\]\s*=\s*['"]([^'"]+)['"]/g;
        let match;
        while ((match = plAssignmentRegex.exec(scriptContent)) !== null) {
            plMap[match[1]] = match[2];
        }
    });

    // 2. Parse <li> elements using Cheerio selectors
    /** @type {PlaylistTranslation[]} */
    const translations = [];
    const liElements = $('li[data-click="translate"]');

    if (liElements.length === 0 && Object.keys(plMap).length > 0) {
        return [{
            translation: 'Default',
            plist: await fetchPlaylist(plMap[Object.keys(plMap)[0]])
        }];
    }

    for(let i = 0; i < liElements.length; i++) {
        const el = liElements[i];
        const $li =$(el);
        let translateId = $li.attr('data-translate');

        // Fallback to '0' if data-translate attribute is empty or missing
        if (!translateId) {
            translateId = '0';
        }

        const translationName = $li.text().trim();
        const plistUrl = plMap[translateId];

        if (plistUrl) {
            translations.push({
                translation: translationName,
                plist: await fetchPlaylist(plistUrl)
            });
        }
    }

    return translations;
}

/**
 * @param {string} plistUrl
 * @returns {Promise<PlayListItem[]>}
 */
export async function fetchPlaylist(plistUrl) {
    /**
     * @type {PlayListItem[]}
     */
    let episodes = [];
    const playlistUrl = plistUrl.startsWith('http') ? plistUrl : `https://seasonvar.ru${plistUrl}`;
    const playlistRes = await fetch(playlistUrl, { headers: HEADERS });
    const playlistData = await playlistRes.json();

    if (Array.isArray(playlistData)) {
        episodes = playlistData
            .map(ep => {
                const decodedFile = decodeSeasonvarLink(ep.file);
                return {
                    title: ep.title.replace(/<br\s*\/?>/gi, ' - ').replace(/\s+/g, ' ').trim(),
                    file: decodedFile
                };
            })
            .filter(ep => ep.file && ep.file.startsWith('http'));
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

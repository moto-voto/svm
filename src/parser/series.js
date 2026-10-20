import { load } from "cheerio";
import { parsePlaylistTranslations } from "./playlists.js"

/** @import { PlaylistTranslation } from "./playlists.js" */


/**
 * @typedef SeasonLink
 * @property {string} title
 * @property {string} link
 * @property {boolean} isCurrent
 */

/**
 * @typedef Series
 * @property {SeasonLink[]} seasons
 * @property {PlaylistTranslation[]} currentSeasonPlaylists
 */

/**
 * @param {string} htmlContent
 * @param {string} targetUrl
 * @returns {Promise<Series>}
 */

export async function parseSeries(htmlContent, targetUrl) {
    const $ = load(htmlContent);

    /** @type {SeasonLink[]} */
    const seasons = [];

    // Based on test.html structure, seasons are inside .pgs-seaslist .tabs-result
    $('.pgs-seaslist .tabs-result a').each((i, el) => {
        const $link = $(el);
        const text = $link.text().trim();
        const href = $link.attr('href');

        const isCurrent = text.includes('>>>');
        let cleanTitle = text;
        if (isCurrent) {
            // Remove the >>> prefix only
            const match = text.match(/^>>>/);
            if (match) cleanTitle = text.substring(match[0].length).trim();
        } else {
            cleanTitle = text.replace(/^>>>/, '').trim();
        }

        // Remove date and episode info (format: DD.MM.YYYY + series info)
        // Match date pattern and remove everything after it
        cleanTitle = cleanTitle.replace(/\d{1,2}\.\d{1,2}\.\d{4}\s+.+$/, '').trim();

        seasons.push({
            title: cleanTitle,
            link: href ? (href.startsWith('http') ? href : `${targetUrl}${href}`) : '#',
            isCurrent: isCurrent
        });
    });

    const playlist = await parsePlaylistTranslations(htmlContent);
    
    return {
        seasons: seasons,
        currentSeasonPlaylists: playlist
    }
}

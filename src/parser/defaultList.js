import { load } from 'cheerio';

/** @import { SerialDescription } from './search.js' */
/**
 * 
 * @param {string} htmlContent
 * @param {string} targetUrl
 * @returns {SerialDescription[]}
 */
export function parseDefaultList(htmlContent, targetUrl) {
    /**
     * @type {SerialDescription[]}
     */
    let results = [];
    const $ = load(htmlContent);

    // Find all .news blocks and extract serial descriptions
    $('.news').each((i, el) => {
        const infoBlock = $(el);

        // Find all links with data-id inside the news block
        infoBlock.find('a[data-id]').each((j, linkEl) => {
            const $link = $(linkEl);
            const id = $link.attr('data-id');
            if (!id) return;

            // Build the full link
            const link = $link.attr('href') || '';
            const fullLink = link.startsWith('http') 
                ? link 
                : `${targetUrl}/${link.replace(/^\//, '')}`;

            // Extract title from .news_n
            const newsN = $link.find('.news_n');
            let title = newsN.text().trim().replace(/\s+/g, ' ');

            // Build image URL from ID
            const imageUrl = `https://cdn.svstat.net/oblojka/${id}.jpg`;

            // Extract season info (e.g., "(5 сезон)")
            let seasonInfo = null;
            const seasonSpan = $link.find('.news_w div:not(.news_n)');
            if (seasonSpan.length > 0) {
                seasonInfo = seasonSpan.text().trim().replace(/\s+/g, ' ');
            }

            // Extract episode info from .news_s
            let episodeInfo = null;
            const episodeSpan = $link.find('.news_s');
            if (episodeSpan.length > 0) {
                episodeInfo = episodeSpan.text().trim().replace(/\s+/g, ' ');
            }

            // Build description combining season and episode info
            let description = null;
            if (seasonInfo || episodeInfo) {
                if (seasonInfo && episodeInfo) {
                    description = `${seasonInfo}\n${episodeInfo}`;
                } else if (seasonInfo) {
                    description = seasonInfo;
                } else if (episodeInfo) {
                    description = episodeInfo;
                }
            }

            // Check if title is valid (more than 1 character)
            if (title.length > 1) {
                results.push({
                    id,
                    title,
                    fullLink,
                    image: imageUrl,
                    description: description || null
                });
            }
        });
    });

    return results;
}
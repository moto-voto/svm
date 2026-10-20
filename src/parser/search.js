import { load } from 'cheerio';

/**
 * @typedef SerialDescription
 * @property {string} title
 * @property {string} fullLink
 * @property {string | null} image
 * @property {string | null} description
 */


/**
 * @param {string} htmlContent
 * @param {string} targetUrl
 */
export function parseSearchResults(htmlContent, targetUrl) {
    /**
     * @type {SerialDescription[]}
     */
    let results = [];
    const $ = load(htmlContent);

    // Seasonvar search results are wrapped in .pgs-search-wrap
    $('.pgs-search-wrap').each((i, el) => {
        const infoBlock = $(el).find('.pgs-search-info');
        const titleLink = infoBlock.find('a').first();

        let title = titleLink.text().trim().replace(/\s+/g, ' ');
        let link = titleLink.attr('href');

        // Extract Image
        let imageSrc = $(el).find('a.pst img').attr('src');
        if (imageSrc && imageSrc.startsWith('//')) {
            imageSrc = 'https:' + imageSrc;
        }

        // Extract Description
        let description = infoBlock.find('p').text().trim().replace(/\s+/g, ' ');

        if (title && link && title.length > 1) {
            results.push({
                title,
                fullLink: link.startsWith('http') ? link : `${targetUrl}/${link.replace(/^\//, '')}`,
                image: imageSrc || null,
                description: description || null
            });
        }
    });
    return results;
}
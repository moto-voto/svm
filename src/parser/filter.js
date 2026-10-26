import { load } from 'cheerio';
/** @import { SerialDescription } from '../parser/search.js'; */

/**
 * Parse seasonvar filter results (alphabetical list format).
 * 
 * @param {string} htmlContent - The HTML content of filtered results page
 * @param {string} targetUrl - The base URL for constructing full links
 * @returns {SerialDescription[]}
 */
export function parseFilterResults(htmlContent, targetUrl) {
    /** @type {SerialDescription[]} */
    const results = [];
    const $ = load(htmlContent);

    // Filter results are wrapped in .letter elements with data-tabt
    $('.letter[data-tabt]').each((i, el) => {
        const letterDiv = $(el);
        const letterChar = letterDiv.find('span').text().trim();

        const hiddenDiv = letterDiv.next();
        if (!hiddenDiv || !hiddenDiv.length) return;

        hiddenDiv.find('a').each((j, linkEl) => {
            const $link = $(linkEl);
            const id = $link.attr('data-id');
            if (!id) return;

            const link = $link.attr('href') || '';
            const title = $link.text().trim().replace(/\s+/g, ' ');

            results.push({
                id,
                title,
                fullLink: link.startsWith('http') ? link : new URL(link, targetUrl).href,
                image: null,
                description: null
            });
        });
    });

    return results;
}

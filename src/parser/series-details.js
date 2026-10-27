import { load } from "cheerio";
import { isTag, isText } from "domhandler";
import { cleanSeriesTitle } from "../common.js";

/**
 * @typedef SeriesDetails
 * @property {string} id
 * @property {string} idSerial
 * @property {string} title
 * @property {string} fullLink
 * @property {string} image
 * @property {string | null} description
 * @property {string | null} year
 * @property {string | null} country
 * @property {string | null} genre
 * @property {string | null} imdb
 * @property {string | null} kinopoisk
 * @property {string | null} originalName
 * @property {number | null} seasons
 */

/**
 * Parses series details from the SeasonVar HTML page.
 * @param {string} html - The raw HTML content.
 * @returns {SeriesDetails}
 */
export function parseSeriesDetails(html) {
    const $ = load(html);

    // Container with attributes id-season and id-serial
    const sinfoEl = $('.pgs-sinfo');
    const idSeason = sinfoEl.attr('data-id-season') || '';
    const idSerial = sinfoEl.attr('data-id-serial') || idSeason || '';
    // Construct a composite or main ID if needed; using season-serial or just id-season
    const id = idSeason || idSerial || '';

    // Title: h1.pgs-sinfo-title
    let title = $('.pgs-sinfo-title').first().text().trim() || '';
    title = cleanSeriesTitle(title);

    // fullLink: canonical link or og:url
    const fullLink = $('link[rel="canonical"]').attr('href') || $('meta[property="og:url"]').attr('content') || '';

    // Image: og:image or poster img src
    const image = $('meta[property="og:image"]').attr('content') || $('.pgs-sinfo-img img').attr('src') || '';

    // Description: metadata description or first paragraph in info
    const description = $('.pgs-sinfo-info > p').first().text().trim() ||$('meta[name="description"]').attr('content') ||  null;

    // Helper to extract text fields based on labels inside pgs-sinfo_list
    /**
     * @param {string} labelText
     * @returns {string | null}
     */
    function getInfoListText(labelText) {
        let textVal = null;
        $('.pgs-sinfo_list').each((_, el) => {
            const nodes = $(el).contents().toArray();
            for (let i = 0; i < nodes.length; i++) {
                const node = nodes[i];
                // TypeScript now knows this is a Text node -> node.data is safe
                if (isText(node) && node.data.includes(labelText)) {
                    for (let j = i + 1; j < nodes.length; j++) {
                        const next = nodes[j];
                        // TypeScript now knows this is an Element -> next.name is safe
                        if (isTag(next) && next.name === 'span') {
                            textVal = $(next).text().trim();
                            return false; // break out of .each
                        }
                    }
                }
            }
        });
        return textVal;
    }

    // Year ("Вышел: 2009")
    let year = null;
    $('.pgs-sinfo_list').each((_, el) => {
        const text = $(el).text();
        if (text.includes('Вышел:')) {
            const match = text.match(/Вышел:\s*(\d{4})/);
            if (match) year = match[1];
        }
    });

    // Country ("Страна: США")
    const country = getInfoListText('Страна:');

    // Genre ("Жанр: комедия, мелодрамы")
    const genre = getInfoListText('Жанр:');

    // IMDB rating ("IMDB: 7.20")
    let imdb = null;
    $('.pgs-sinfo_list.rating').each((_, el) => {
        const text = $(el).text();
        if (text.includes('IMDB:')) {
            const match = text.match(/IMDB:\s*([\d.]+)/);
            if (match) imdb = match[1];
        }
    });

    // Kinopoisk rating ("КиноПоиск: 7.24")
    let kinopoisk = null;
    $('.pgs-sinfo_list.rating').each((_, el) => {
        const text = $(el).text();
        if (text.includes('КиноПоиск:')) {
            const match = text.match(/КиноПоиск:\s*([\d.]+)/);
            if (match) kinopoisk = match[1];
        }
    });

    // Original Name ("Оригинал: 10 Things I Hate About You")
    const originalName = getInfoListText('Оригинал:');

    // Seasons: extracted from the seasons list block or text description like "из 20"
    let seasons = $('.pgs-seaslist a').length;

    return {
        id,
        idSerial,
        title,
        fullLink,
        image: image,
        description: description || null,
        year: year || null,
        country: country || null,
        genre: genre || null,
        imdb: imdb || null,
        kinopoisk: kinopoisk || null,
        originalName: originalName || null,
        seasons: seasons || null
    };
}

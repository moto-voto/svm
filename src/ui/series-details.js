/**
 * Pure display helpers for the series-details page
 * (`pages/SeriesDetailsPage.jsx`).
 */

export const RATING_FALLBACK = 'Н/Д';
export const PLACEHOLDER_POSTER = 'https://placehold.co/400x600/1e1e24/ff9900';

/**
 * Upgrade protocol-relative poster URLs; pass others through.
 * @param {string} url
 */
export function normalizeImageUrl(url) {
    if (!url) return '';
    return url.startsWith('//') ? `https:${url}` : url;
}

/**
 * Placeholder poster URL for a series title.
 * @param {string | null | undefined} title
 */
export function buildPosterFallback(title) {
    return `${PLACEHOLDER_POSTER}?text=${encodeURIComponent(title || 'Series')}`;
}

/**
 * Russian label for the season count field.
 * @param {number | null | undefined} seasons
 */
export function formatSeasonsLabel(seasons) {
    if(!seasons) return '—';

    const n = seasons % 10;
    if(n === 1) return `${seasons} сезон`;
    if([2, 3, 4].includes(n) ) return `${seasons} сезона`;
    return `${seasons} сезонов`;
}

/**
 * Rating value or the "not available" fallback.
 * @param {string | null | undefined} value
 */
export function formatRating(value) {
    return value || RATING_FALLBACK;
}

/**
 * Build the client-side player link, optionally pointing at a specific season
 * so the player loads that season's episodes directly. `title` and `image`
 * (series metadata) are carried along so the player can record them in the
 * watch history without an extra request; `from` keeps the details page's
 * back destination ("history") alive through the player.
 * @param {string} seriesUrl
 * @param {string} [seasonLink]
 * @param {string} [title]
 * @param {string} [image]
 * @param {string} [from]
 */
export function buildPlayerHref(seriesUrl, seasonLink, title, image, from) {
    const url = encodeURIComponent(seriesUrl || '');
    const season = seasonLink ? `&season=${encodeURIComponent(seasonLink)}` : '';
    const name = title ? `&title=${encodeURIComponent(title)}` : '';
    const img = image ? `&image=${encodeURIComponent(image)}` : '';
    const ref = from ? `&from=${encodeURIComponent(from)}` : '';
    return `/series?url=${url}${season}${name}${img}${ref}`;
}

/**
 * Where the details page's back button should go. The history page links in
 * with `?from=history`; everything else (search tiles, direct links) falls
 * back to the main search page.
 * @param {string | null | undefined} from raw `?from=` value
 * @returns {string}
 */
export function resolveBackHref(from) {
    return from === 'history' ? '/history' : '/';
}

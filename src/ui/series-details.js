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
    return seasons ? `${seasons} сезона` : '—';
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
 * so the player loads that season's episodes directly.
 * @param {string} seriesUrl
 * @param {string} [seasonLink]
 */
export function buildPlayerHref(seriesUrl, seasonLink) {
    const url = encodeURIComponent(seriesUrl || '');
    const season = seasonLink ? `&season=${encodeURIComponent(seasonLink)}` : '';
    return `/series?url=${url}${season}`;
}
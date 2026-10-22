/**
 * Pure display helpers for the series-details page
 * (`pages/SeriesDetailsPage.jsx`).
 */

export const RATING_FALLBACK = 'Н/Д';
export const PLACEHOLDER_POSTER = 'https://placehold.co/400x600/1e1e24/ff9900';

/** Upgrade protocol-relative poster URLs; pass others through. */
export function normalizeImageUrl(url) {
    if (!url) return '';
    return url.startsWith('//') ? `https:${url}` : url;
}

/** Placeholder poster URL for a series title. */
export function buildPosterFallback(title) {
    return `${PLACEHOLDER_POSTER}?text=${encodeURIComponent(title || 'Series')}`;
}

/** Russian label for the season count field. */
export function formatSeasonsLabel(seasons) {
    return seasons ? `${seasons} сезона` : '—';
}

/** Rating value or the "not available" fallback. */
export function formatRating(value) {
    return value || RATING_FALLBACK;
}
/**
 * Small pure helpers shared by the UI (see `pages/PlayerPage.jsx`).
 */

/** Strip a trailing dangling parenthesis from raw titles. */
export function cleanTitle(rawTitle) {
    return (rawTitle || '').replace(/\s*\(\s*$/, '').trim();
}

/**
 * Format seconds as MM:SS or HH:MM:SS.
 * @param {number} seconds
 */
export function formatTime(seconds) {
    if (isNaN(seconds) || seconds === Infinity) return '00:00';
    const pad = (num) => String(num).padStart(2, '0');
    const sec = Math.floor(seconds % 60);
    const min = Math.floor((seconds / 60) % 60);
    const hrs = Math.floor(seconds / 3600);
    return hrs > 0 ? `${pad(hrs)}:${pad(min)}:${pad(sec)}` : `${pad(min)}:${pad(sec)}`;
}
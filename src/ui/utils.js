
/**
 * Small pure helpers shared by the UI (see `pages/PlayerPage.jsx`).
 * Clamp `value` into the inclusive `[min, max]` range.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 */
export function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

/**
 * Normalize a user-entered search query (null/undefined safe).
 * @param {string} value
 */
export function normalizeQuery(value) {
    return (value ?? '').trim();
}

/**
 * Strip a trailing dangling parenthesis from raw titles.
 * @param {string} rawTitle
 */
export function cleanTitle(rawTitle) {
    return (rawTitle || '').replace(/\s*\(\s*$/, '').trim();
}

/**
 * Format seconds as MM:SS or HH:MM:SS.
 * @param {number} seconds
 */
export function formatTime(seconds) {
    if (isNaN(seconds) || seconds === Infinity) return '00:00';
    const pad = (/** @type {number} */ num) => String(num).padStart(2, '0');
    const sec = Math.floor(seconds % 60);
    const min = Math.floor((seconds / 60) % 60);
    const hrs = Math.floor(seconds / 3600);
    return hrs > 0 ? `${pad(hrs)}:${pad(min)}:${pad(sec)}` : `${pad(min)}:${pad(sec)}`;
}

//
// Deployment base path (detected at runtime)
//
// The app can be hosted at the root (`/`) or under any prefix (`/svm`, ...)
// chosen by whoever configures nginx. The prefix is not known at build time,
// so the production bundle is built with Vite's relative base (`./`) and the
// real prefix is derived at runtime from the URL the entry script was loaded
// from. The entry chunk always lives at `<prefix>/assets/<file>.js`, so its
// directory minus `assets/` is the deployment prefix.
//
// `BASE_URL`   -> "/" | "/svm/"   (leading + trailing slash, for asset/URL building)
// `BASE_PATH`  -> ""  | "/svm"    (no trailing slash, for the router `base` prop)
//

/**
 * Derive the deployment base from the URL of the loaded entry module.
 *
 * Production chunks live in `<base>/assets/`, while the Vite dev server serves
 * modules from `<base>/src/...`, so both shapes are handled:
 *
 *   https://host/svm/assets/index-abc.js  -> /svm/
 *   https://host/assets/index-abc.js      -> /
 *   http://localhost:5173/svm/src/ui/x.js -> /svm/
 *
 * @param {string} scriptUrl
 * @returns {string} base path with a trailing slash
 */
export function basePathFromScriptUrl(scriptUrl) {
  const { pathname } = new URL(scriptUrl);
  const dir = pathname.slice(0, pathname.lastIndexOf('/') + 1); // .../assets/ or .../src/ui/
  // Production: the entry chunk lives at <base>/assets/<file>.js.
  if (/\/assets\/$/.test(dir)) return dir.replace(/\/assets\/$/, '/');
  // Dev: Vite serves source modules from <base>/src/...; use the last segment
  // so a prefix that itself contains "/src/" is preserved.
  const srcIndex = dir.lastIndexOf('/src/');
  if (srcIndex !== -1) return `${dir.slice(0, srcIndex)}/`;
  return dir || '/';
}

/**
 * Join a base path with an app-relative path.
 *
 * `joinBase('/svm', '/api/search')` -> `/svm/api/search`
 * `joinBase('', '/api/search')`     -> `/api/search`
 *
 * @param {string} basePath no trailing slash ("" at the root)
 * @param {string} path
 */
export function joinBase(basePath, path) {
  const clean = String(path ?? '').replace(/^\/+/, '');
  const prefix = String(basePath ?? '').replace(/\/+$/, '');
  if (!clean) return prefix || '/';
  return `${prefix}/${clean}`;
}

function detectBasePath() {
  // Node / SSR / unit tests: no DOM, assume the root.
  if (typeof document === 'undefined') return '/';
  return basePathFromScriptUrl(import.meta.url);
}

export const BASE_URL = detectBasePath();
export const BASE_PATH = BASE_URL.replace(/\/+$/, "");

/**
 * Prefix an app-relative path with the detected deployment base path.
 *
 * `withBase('/api/search')` -> `/api/search` at the root and
 * `/svm/api/search` when hosted under `/svm`.
 *
 * @param {string} path
 */
export function withBase(path) {
  return joinBase(BASE_PATH, path);
}

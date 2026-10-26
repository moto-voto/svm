//
// Per-URL in-memory cache for API responses (see `api.js`).
//
// The underlying data is very stable (changes a few times per hour at most),
// so identical requests within the TTL are served from memory instead of
// hitting the backend again. The cache lives in the JS context only: a browser
// reload intentionally clears it (the `?q=`/`?url=` URL parameters remain the
// shareable state), and there is deliberately no localStorage persistence.
//
// The cache stores the **raw response string**, not the parsed object: every
// caller gets its own freshly parsed copy, so a caller mutating its result
// can never corrupt what other calls (or the cache) see.
//

/**
 * How long a cached response stays fresh (10 minutes).
 */
export const API_CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * @typedef {{
 *   text: string,
 *   expiresAt: number,
 * }} ApiCacheEntry
 */

/**
 * Reject payload shapes the backend uses to report errors (sent with HTTP 200
 * by some endpoints), so they are never cached as successes.
 * @param {any} data parsed response body
 */
function throwIfApiError(data) {
    if (data && !Array.isArray(data) && data.error) {
        throw new Error(String(data.error));
    }
}

/**
 * Create a caching wrapper around a raw-text loader.
 *
 * - Successful responses are cached per URL (as strings) and reused for
 *   `ttlMs` without a new request; each read is parsed afresh.
 * - Concurrent calls for the same URL share a single in-flight request.
 * - Failures (HTTP errors, invalid JSON, `{error}` payloads) are never cached:
 *   the next call retries the loader.
 * - Expired entries are pruned as newer responses are stored.
 *
 * @param {(url: string) => Promise<string>} fetchText performs the actual
 *   request and resolves with the raw response body (rejects on HTTP errors)
 * @param {{ ttlMs?: number, now?: () => number }} [options] injectable TTL and
 *   clock for tests
 * @returns {(url: string) => Promise<any>} resolves with the parsed JSON body
 */
export function createCachedApi(fetchText, options = {}) {
    const ttlMs = options.ttlMs ?? API_CACHE_TTL_MS;
    const now = options.now ?? Date.now;

    /** @type {Map<string, ApiCacheEntry>} */
    const cache = new Map();
    /** @type {Map<string, Promise<string>>} */
    const inFlight = new Map();

    /** Drop expired entries so the cache cannot grow without bound. */
    const prune = () => {
        const ts = now();
        for (const [key, entry] of cache) {
            if (entry.expiresAt <= ts) {
                cache.delete(key);
            }
        }
    };

    /** Parse the (already validated) response text into a fresh object. */
    const deliver = (/** @type {string} */ text) => JSON.parse(text);

    /**
     * @param {string} url cache key (the full request URL)
     * @returns {Promise<any>}
     */
    return function cachedApi(url) {
        const cached = cache.get(url);
        if (cached) {
            if (cached.expiresAt > now()) {
                return Promise.resolve(JSON.parse(cached.text));
            }
            cache.delete(url);
        }

        const pending = inFlight.get(url);
        if (pending) {
            return pending.then(deliver);
        }

        const request = fetchText(url)
            .then((text) => {
                // Validate before caching: failed requests, unparseable bodies
                // and `{error}` payloads must never enter the cache — any of
                // these rejects, skipping `cache.set`, so the next call retries
                // the loader instead of replaying the failure for the TTL.
                let data;
                try {
                    data = JSON.parse(text);
                } catch {
                    throw new Error('Invalid JSON response from server');
                }
                throwIfApiError(data);
                prune();
                cache.set(url, { text, expiresAt: now() + ttlMs });
                return text;
            })
            .finally(() => {
                inFlight.delete(url);
            });

        inFlight.set(url, request);
        return request.then(deliver);
    };
}

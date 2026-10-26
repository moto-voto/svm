/**
 * Minimal `fetch` stub for frontend unit tests.
 * Routes are matched by simple substring against the request URL.
 */

/**
 * @param {Array<{ match: string, body: unknown, status?: number, statusText?: string }>} routes
 */
export function installFetch(routes) {
    const original = globalThis.fetch;
    /** @type {Array<{ url: string, options: unknown }>} */
    const calls = [];

    globalThis.fetch = async (url, options) => {
        const urlStr = String(url);
        calls.push({ url: urlStr, options });

        const route = routes.find((r) => urlStr.includes(r.match));
        if (!route) {
            throw new Error(`Unexpected fetch: ${urlStr}`);
        }

        const body = route.body;
        const status = route.status ?? 200;

        return {
            ok: status >= 200 && status < 300,
            status,
            statusText: route.statusText ?? (status === 200 ? 'OK' : 'Error'),
            async json() {
                return typeof body === 'string' ? JSON.parse(body) : body;
            },
            async text() {
                return JSON.stringify(body);
            },
        };
    };

    return {
        calls,
        restore() {
            globalThis.fetch = original;
        },
    };
}
/**
 * Minimal `fetch` stub for backend unit tests.
 * Routes are matched by simple substring against the request URL.
 */

/**
 * @param {Array<{ match: string, body: unknown, status?: number }>} routes
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
            statusText: status === 200 ? 'OK' : 'Error',
            async text() {
                return typeof body === 'string' ? body : JSON.stringify(body);
            },
            async json() {
                return typeof body === 'string' ? JSON.parse(body) : body;
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
import test from 'node:test';
import assert from 'node:assert/strict';

import { createCachedApi, API_CACHE_TTL_MS } from '../../src/ui/api-cache.js';

/**
 * Fake text loader: resolves canned bodies per URL, counts calls, and can be
 * armed to fail or to wait for manual resolution.
 * @param {Record<string, string>} bodies
 */
function makeLoader(bodies) {
    /** @type {{ calls: string[], bodies: Record<string, string>, failWith?: Error, manual?: boolean, deferred?: { resolve: (v: string) => void, reject: (e: Error) => void } }} */
    const state = { calls: [], bodies };
    /** @param {string} url */
    state.loader = (url) => {
        state.calls.push(url);
        if (state.failWith) {
            return Promise.reject(state.failWith);
        }
        if (state.manual) {
            return new Promise((resolve, reject) => {
                state.deferred = { resolve, reject };
            });
        }
        const body = state.bodies[url];
        if (body === undefined) {
            return Promise.reject(new Error(`no canned body for ${url}`));
        }
        return Promise.resolve(body);
    };
    return state;
}

test('API_CACHE_TTL_MS is 10 minutes', () => {
    assert.equal(API_CACHE_TTL_MS, 10 * 60 * 1000);
});

test('repeated calls within the TTL do not hit the loader', async () => {
    let now = 1000;
    const state = makeLoader({ '/a': '{"v":1}' });
    const api = createCachedApi(state.loader, { now: () => now });

    assert.deepEqual(await api('/a'), { v: 1 });
    assert.deepEqual(await api('/a'), { v: 1 });
    assert.deepEqual(state.calls, ['/a']);
});

test('cache stores raw strings: every call gets a freshly parsed object', async () => {
    let now = 1000;
    const state = makeLoader({ '/a': '{"v":1,"nested":{"x":2}}' });
    const api = createCachedApi(state.loader, { now: () => now });

    const first = await api('/a');
    const second = await api('/a');
    assert.deepEqual(first, second);
    assert.notEqual(first, second); // distinct parses of the same text
    assert.notEqual(first.nested, second.nested);
});

test('mutating a returned object never corrupts later results', async () => {
    let now = 1000;
    const state = makeLoader({ '/a': '{"v":1,"nested":{"x":2}}' });
    const api = createCachedApi(state.loader, { now: () => now });

    const first = await api('/a');
    first.v = 999;
    first.nested.x = 999;
    first.nested = null;

    const second = await api('/a');
    assert.deepEqual(second, { v: 1, nested: { x: 2 } });
});

test('entries expire after the TTL and trigger a refetch', async () => {
    let now = 1000;
    const state = makeLoader({ '/a': '{"v":1}' });
    const api = createCachedApi(state.loader, { now: () => now, ttlMs: 500 });

    await api('/a');
    now += 499;
    await api('/a');
    assert.deepEqual(state.calls, ['/a']);

    now += 1; // exactly at the TTL boundary -> expired
    await api('/a');
    assert.deepEqual(state.calls, ['/a', '/a']);
    assert.deepEqual(await api('/a'), { v: 1 });
});

test('different URLs are cached independently', async () => {
    let now = 1000;
    const state = makeLoader({ '/a': '{"v":"a"}', '/b': '{"v":"b"}' });
    const api = createCachedApi(state.loader, { now: () => now });

    assert.deepEqual(await api('/a'), { v: 'a' });
    assert.deepEqual(await api('/b'), { v: 'b' });
    await api('/a');
    assert.deepEqual(state.calls, ['/a', '/b']);
});

test('concurrent calls for the same URL share one in-flight request', async () => {
    let now = 1000;
    const state = makeLoader({ '/a': '{"v":1}' });
    state.manual = true; // hold the request until we resolve it by hand
    const api = createCachedApi(state.loader, { now: () => now });

    const p1 = api('/a');
    const p2 = api('/a');
    assert.deepEqual(state.calls, ['/a']); // second call deduped

    state.deferred.resolve('{"v":1}');
    const [r1, r2] = await Promise.all([p1, p2]);
    assert.deepEqual(state.calls, ['/a']);
    assert.deepEqual(r1, { v: 1 });
    assert.deepEqual(r2, { v: 1 });
    assert.notEqual(r1, r2); // parsed separately per caller
});

test('failed requests are never cached: the next call retries', async () => {
    let now = 1000;
    const state = makeLoader({ '/a': '{"v":1}' });
    const api = createCachedApi(state.loader, { now: () => now });

    state.failWith = new Error('HTTP 500 Internal Server Error');
    await assert.rejects(api('/a'), /HTTP 500/);

    state.failWith = undefined;
    assert.deepEqual(await api('/a'), { v: 1 });
    assert.deepEqual(state.calls, ['/a', '/a']); // retried, then cached

    await api('/a');
    assert.deepEqual(state.calls, ['/a', '/a']);
});

test('unparseable JSON is never cached', async () => {
    let now = 1000;
    const state = makeLoader({ '/a': 'not json', '/b': '{"v":1}' });
    const api = createCachedApi(state.loader, { now: () => now });

    await assert.rejects(api('/a'), /Invalid JSON response from server/);
    await assert.rejects(api('/a'), /Invalid JSON response from server/);
    assert.deepEqual(state.calls, ['/a', '/a']); // retried every time

    // A later good response for the same URL is cached normally.
    state.bodies = { ...state.bodies, '/a': '{"v":1}' };
    assert.deepEqual(await api('/a'), { v: 1 });
    assert.deepEqual(state.calls, ['/a', '/a', '/a']);
    await api('/a');
    assert.deepEqual(state.calls, ['/a', '/a', '/a']);
});

test('{error} payloads are rejected and never cached', async () => {
    let now = 1000;
    const state = makeLoader({ '/a': '{"error":"Series URL is required"}' });
    const api = createCachedApi(state.loader, { now: () => now });

    await assert.rejects(api('/a'), /Series URL is required/);
    await assert.rejects(api('/a'), /Series URL is required/);
    assert.deepEqual(state.calls, ['/a', '/a']);
});

test('a fresh cached entry shields the caller from loader failures', async () => {
    let now = 1000;
    const state = makeLoader({ '/a': '{"v":1}' });
    const api = createCachedApi(state.loader, { now: () => now });

    assert.deepEqual(await api('/a'), { v: 1 });

    // While the entry is fresh, even an armed loader failure is never reached:
    // the cached success is served and the failure arm is left unused.
    state.failWith = new Error('HTTP 503 Service Unavailable');
    assert.deepEqual(await api('/a'), { v: 1 });
    assert.deepEqual(state.calls, ['/a']);

    // After expiry the loader is consulted again and the failure surfaces;
    // nothing was cached, so a later recovery is picked up.
    now += API_CACHE_TTL_MS + 1;
    await assert.rejects(api('/a'), /HTTP 503/);
    state.failWith = undefined;
    assert.deepEqual(await api('/a'), { v: 1 });
    assert.deepEqual(state.calls, ['/a', '/a', '/a']);
});

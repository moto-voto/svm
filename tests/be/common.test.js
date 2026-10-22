import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

import { log } from '../../src/common.js';

test('log prefixes the message with a timestamp and the upper-cased level', () => {
    const spy = mock.method(console, 'log', () => {});
    try {
        log('log', 'hello world');

        assert.equal(spy.mock.calls.length, 1);
        assert.match(spy.mock.calls[0].arguments[0], /^\[.+\] LOG: hello world$/);
    } finally {
        spy.mock.restore();
    }
});

test('log routes warnings to console.warn', () => {
    const spy = mock.method(console, 'warn', () => {});
    try {
        log('warn', 'careful');
        assert.match(spy.mock.calls[0].arguments[0], /WARN: careful$/);
    } finally {
        spy.mock.restore();
    }
});
import test from 'node:test';
import assert from 'node:assert/strict';

import {windStep, encodeWind, decodeWind} from '../src/encode.js';

// an arbitrary per-image range, as prepare.js would measure it
const RANGE = 46;

test('zero is exactly representable', () => {
    assert.equal(encodeWind(0, RANGE), 128);
    assert.equal(decodeWind(128, RANGE), 0);
});

test('endpoints land on codes 1 and 255', () => {
    assert.equal(encodeWind(RANGE, RANGE), 255);
    assert.equal(encodeWind(-RANGE, RANGE), 1);
    assert.equal(decodeWind(255, RANGE), RANGE);
    assert.equal(decodeWind(1, RANGE), -RANGE);
});

test('codes stay in 1..255 across the range', () => {
    for (let value = -RANGE; value <= RANGE; value += 0.01) {
        const code = encodeWind(value, RANGE);
        assert.ok(code >= 1 && code <= 255, `${value} -> ${code}`);
        assert.equal(code, Math.round(code));
    }
});

test('round trip is within half a step', () => {
    const half = windStep(RANGE) / 2;
    for (let value = -RANGE; value <= RANGE; value += 0.017) {
        assert.ok(Math.abs(decodeWind(encodeWind(value, RANGE), RANGE) - value) <= half + 1e-12);
    }
});

test('decode commutes with bilinear interpolation', () => {
    const [a, b] = [encodeWind(-7.5, RANGE), encodeWind(21.25, RANGE)];
    for (const t of [0, 0.25, 1 / 3, 0.5, 0.75, 1]) {
        const mix = (x, y) => x + (y - x) * t;
        const decoded = mix(decodeWind(a, RANGE), decodeWind(b, RANGE));
        assert.ok(Math.abs(decodeWind(mix(a, b), RANGE) - decoded) < 1e-12);
    }
});

test('the range only rescales, leaving zero and the endpoints put', () => {
    for (const range of [1, 32, 46, 137.5]) {
        assert.equal(encodeWind(0, range), 128);
        assert.equal(encodeWind(range, range), 255);
        assert.equal(windStep(range), range / 127);
        // a code means a fixed fraction of the range, whatever the range is
        assert.ok(Math.abs(decodeWind(200, range) / range - 72 / 127) < 1e-12);
    }
});

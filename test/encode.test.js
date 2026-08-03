import test from 'node:test';
import assert from 'node:assert/strict';

import {WIND_RANGE, windStep, encodeWind, decodeWind, clampWind} from '../src/encode.js';

test('zero is exactly representable', () => {
    assert.equal(encodeWind(0), 128);
    assert.equal(decodeWind(128), 0);
});

test('endpoints land on codes 1 and 255', () => {
    assert.equal(encodeWind(WIND_RANGE), 255);
    assert.equal(encodeWind(-WIND_RANGE), 1);
    assert.equal(decodeWind(255), WIND_RANGE);
    assert.equal(decodeWind(1), -WIND_RANGE);
});

test('codes stay in 1..255 across the range', () => {
    for (let value = -WIND_RANGE; value <= WIND_RANGE; value += 0.01) {
        const code = encodeWind(value);
        assert.ok(code >= 1 && code <= 255, `${value} -> ${code}`);
        assert.equal(code, Math.round(code));
    }
});

test('round trip is within half a step', () => {
    const half = windStep() / 2;
    for (let value = -WIND_RANGE; value <= WIND_RANGE; value += 0.017) {
        assert.ok(Math.abs(decodeWind(encodeWind(value)) - value) <= half + 1e-12);
    }
});

test('decode commutes with bilinear interpolation', () => {
    const [a, b] = [encodeWind(-7.5), encodeWind(21.25)];
    for (const t of [0, 0.25, 1 / 3, 0.5, 0.75, 1]) {
        const mix = (x, y) => x + (y - x) * t;
        assert.ok(Math.abs(decodeWind(mix(a, b)) - mix(decodeWind(a), decodeWind(b))) < 1e-12);
    }
});

test('clamp preserves direction and fits the largest component', () => {
    const [u, v] = clampWind(50, 20);
    assert.ok(Math.max(Math.abs(u), Math.abs(v)) <= WIND_RANGE + 1e-12);
    assert.ok(Math.abs(Math.atan2(20, 50) - Math.atan2(v, u)) < 1e-12);
});

test('clamp leaves representable vectors untouched, including the corners', () => {
    for (const [u, v] of [[0, 0], [31.9, -12], [WIND_RANGE, -WIND_RANGE]]) {
        assert.deepEqual(clampWind(u, v), [u, v]);
    }
});

test('a custom range rescales both directions consistently', () => {
    assert.equal(encodeWind(40, 40), 255);
    assert.equal(decodeWind(128, 40), 0);
    assert.equal(windStep(40), 40 / 127);
});

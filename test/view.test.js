import test from 'node:test';
import assert from 'node:assert/strict';

import {validateView, rebaseTransform, trailTransform, viewsOverlap, viewMin} from '../src/view.js';

// Transforms are checked by mapping corners, not by comparing coefficients: that's
// what catches a flipped sign or a missed texture-Y inversion.

const apply = ({scale, offset}, [x, y]) => [x * scale[0] + offset[0], y * scale[1] + offset[1]];

const close = (actual, expected, message) => {
    for (const [i, value] of expected.entries()) {
        assert.ok(Math.abs(actual[i] - value) < 1e-12, `${message}: ${actual} != ${expected}`);
    }
};

const world = [0, 0, 1, 1];

test('identity views leave both transforms untouched', () => {
    for (const t of [rebaseTransform(world, world), trailTransform(world, world)]) {
        close(apply(t, [0, 0]), [0, 0], 'origin');
        close(apply(t, [1, 1]), [1, 1], 'far corner');
        close(apply(t, [0.37, 0.62]), [0.37, 0.62], 'interior');
    }
});

test('a pan moves particles against the camera', () => {
    // the view slides a quarter world right, so the ground under it slides a quarter left
    const rebase = rebaseTransform(world, [0.25, 0, 1.25, 1]);
    close(apply(rebase, [0.5, 0.5]), [0.25, 0.5], 'center');
    close(apply(rebase, [0.25, 0.5]), [0, 0.5], 'point reaching the new left edge');
});

test('a zoom about an off-center point keeps that point fixed', () => {
    // halve the span about (0.25, 0.25), which stays put on screen at (0.25, 0.25)
    const view = [0.125, 0.125, 0.625, 0.625];
    const rebase = rebaseTransform(world, view);
    close(apply(rebase, [0.25, 0.25]), [0.25, 0.25], 'anchor');
    close(apply(rebase, [0.125, 0.125]), [0, 0], 'new top-left corner');
    close(apply(rebase, [0.625, 0.625]), [1, 1], 'new bottom-right corner');
    // and the same anchor holds through the trail gather, in flipped texture coordinates
    const trail = trailTransform(world, view);
    close(apply(trail, [0.25, 0.75]), [0.25, 0.75], 'anchor in texture coords');
});

test('the trail gather inverts the particle rebase', () => {
    const view = [3.4, 0.2, 3.9, 0.7];
    const rebase = rebaseTransform(world, view);
    const trail = trailTransform(world, view);
    for (const p of [[0.1, 0.2], [0.5, 0.5], [0.9, 0.8]]) {
        // the gather runs in texture coords, so flip Y going in and coming out
        const flip = ([x, y]) => [x, 1 - y];
        close(flip(apply(trail, flip(apply(rebase, p)))), p, 'round trip');
    }
});

test('a resize that only changes the vertical span scales Y alone', () => {
    // a window growing taller reveals more world above and below the same center
    const rebase = rebaseTransform([0, 0.25, 1, 0.75], [0, 0.125, 1, 0.875]);
    close(apply(rebase, [0.5, 0.5]), [0.5, 0.5], 'center holds');
    close(apply(rebase, [0.5, 0]), [0.5, 1 / 6], 'old top edge moves inwards');
    assert.equal(rebase.scale[0], 1);
});

test('an unwrapped X rect rebases by the fraction, not the world copy', () => {
    // dragged five worlds west, then a tenth of a world further
    const rebase = rebaseTransform([5, 0, 6, 1], [5.1, 0, 6.1, 1]);
    close(apply(rebase, [0.5, 0.5]), [0.4, 0.5], 'pan across the antimeridian');
    // the same pan one world over must be indistinguishable
    close(apply(rebase, [0.5, 0.5]), apply(rebaseTransform(world, [0.1, 0, 1.1, 1]), [0.5, 0.5]), 'copy-invariant');
});

test('the lookup origin is wrapped but keeps its offset within the world', () => {
    close(viewMin([5.25, 0.3]), [0.25, 0.3], 'positive');
    close(viewMin([-2.75, 0.3]), [0.25, 0.3], 'negative');
    close(viewMin([0.9, 0]), [0.9, 0], 'already wrapped');
});

test('a z20-scale span stays exact in doubles', () => {
    const span = 1 / 2 ** 20;
    const prev = [0.3, 0.4, 0.3 + span, 0.4 + span];
    // one span east and half a span south
    const view = [prev[0] + span, prev[1] + span / 2, prev[2] + span, prev[3] + span / 2];
    const rebase = rebaseTransform(prev, view);
    close(apply(rebase, [1, 0.5]), [0, 0], 'old right edge becomes the new left');
    assert.equal(rebase.scale[0], 1);
});

test('overlap is detected across worlds and rejected for a jump', () => {
    assert.ok(viewsOverlap(world, [0.999, 0, 1.999, 1]), 'a sliver still overlaps');
    assert.ok(!viewsOverlap(world, [1, 0, 2, 1]), 'touching edges share no area');
    assert.ok(!viewsOverlap(world, [7.5, 0, 8.5, 1]), 'a jump to another world copy');
    assert.ok(viewsOverlap([5, 0.25, 6, 0.75], [5.5, 0.5, 6.5, 1]), 'diagonal overlap');
    assert.ok(!viewsOverlap([0, 0, 1, 0.4], [0, 0.6, 1, 1]), 'same X, disjoint Y');
});

test('a rect matching the canvas aspect validates', () => {
    validateView([0, 0.25, 1, 0.75], 1000, 500);
    validateView([5.5, 0, 6.5, 1], 800, 800);
    // portrait: the world can only be fitted to the narrow dimension
    validateView([0, 0, 0.5, 1], 500, 1000);
    // within tolerance, as a caller's own division would land
    validateView([0, 0, 1, 0.5000001], 1000, 500);
});

test('validation rejects the ways a rect can be wrong', () => {
    assert.throws(() => validateView([0, 0, 1], 1000, 1000), /four finite numbers/);
    assert.throws(() => validateView([0, 0, 1, NaN], 1000, 1000), /four finite numbers/);
    assert.throws(() => validateView([1, 0, 0, 1], 1000, 1000), /positive span/);
    assert.throws(() => validateView([0, 0, 1, 0], 1000, 1000), /positive span/);
    assert.throws(() => validateView([0, -0.1, 1, 0.9], 1000, 1000), /within \[0, 1\]/);
    assert.throws(() => validateView([0, 0.1, 1, 1.1], 1000, 1000), /within \[0, 1\]/);
    assert.throws(() => validateView([0, 0, 1, 1], 1000, 500), /aspect/);
    assert.throws(() => validateView([0, 0, 1, 0.51], 1000, 500), /aspect/);
});

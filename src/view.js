// The view is a rect `[minX, minY, maxX, maxY]` in Mercator units, Y downwards, covering exactly
// what the canvas shows. Particles and trails are stored relative to the rect they were rendered
// against, so a view change is an affine map rather than a reset — computed here in doubles, since
// a global Mercator intermediate in float32 would lose more than the whole visible span at z20.

export const viewSpan = ([x0, y0, x1, y1]) => [x1 - x0, y1 - y0];

// Throws rather than adjusting the rect, which would silently move the center or extent the caller asked for.
// X may be unwrapped (outside [0,1] denotes another world copy); Y can't be: no world past the Mercator edges.
export function validateView(rect, width, height) {
    if (rect.length !== 4 || !rect.every(Number.isFinite)) {
        throw new Error(`view must be four finite numbers, got ${rect}`);
    }
    const [spanX, spanY] = viewSpan(rect);
    if (spanX <= 0 || spanY <= 0) {
        throw new Error(`view must have a positive span, got ${rect}`);
    }
    if (rect[1] < 0 || rect[3] > 1) {
        throw new Error(`view Y must lie within [0, 1], got ${rect[1]}..${rect[3]}`);
    }
    // the simulation steps in pixels, so a stretched rect would make speed depend on direction
    const expected = spanX * height / width;
    if (Math.abs(spanY - expected) > 1e-3 * expected) { // slack for the caller's own float math
        throw new Error(`view aspect must match the canvas: ${spanY} tall, expected ${expected}`);
    }
}

// Where a particle stored against `prev` lands in `view`. Applied before the simulation step,
// which is then in current-view units, so the stored step holds no camera movement.
export function rebaseTransform(prev, view) {
    const [spanX, spanY] = viewSpan(view);
    const [prevSpanX, prevSpanY] = viewSpan(prev);
    return {
        scale: [prevSpanX / spanX, prevSpanY / spanY],
        offset: [(prev[0] - view[0]) / spanX, (prev[1] - view[1]) / spanY]
    };
}

// Where a pixel of the current view reads from in the trail texture: a gather, so the rects swap — the easiest
// thing here to get backwards. Y flips because V is measured from the bottom edge and the rect from the top.
export function trailTransform(prev, view) {
    const {scale, offset} = rebaseTransform(view, prev);
    return {scale, offset: [offset[0], 1 - scale[1] - offset[1]]};
}

// The part of `view` that `prev` didn't cover, as up to four rects in current-view units, with the
// cumulative area fractions to pick between them. Particles the view change displaced belong here
// rather than anywhere: a pan needs the revealed strip filled at once, and a zoom out has to put its
// whole surplus outside the box it shrank into.
export function revealRects(prev, view) {
    const {scale, offset} = rebaseTransform(prev, view);
    const [x0, y0] = [Math.min(Math.max(offset[0], 0), 1), Math.min(Math.max(offset[1], 0), 1)];
    const [x1, y1] = [Math.min(Math.max(offset[0] + scale[0], x0), 1), Math.min(Math.max(offset[1] + scale[1], y0), 1)];

    // the sides span the full height, so the top and bottom pieces are only as wide as the box:
    // an L for a pan, a full frame for a zoom out, and nothing at all when the box covers the view
    const rects = [[0, 0, x0, 1], [x1, 0, 1, 1], [x0, 0, x1, y0], [x0, y1, x1, 1]];
    const areas = rects.map(([ax, ay, bx, by]) => (bx - ax) * (by - ay));
    const total = areas.reduce((a, b) => a + b, 0);

    let acc = 0;
    // a degenerate rect keeps its slot but no width in the CDF, so it can never be picked
    const cdf = areas.map(a => (acc += a) / (total || 1));
    return {rects: new Float32Array(rects.flat()), cdf, total};
}

// Views sharing no ground have nothing to carry over, so the caller reseeds instead
// of rebasing — which also avoids a jump big enough to overflow the Mercator inversion.
export const viewsOverlap = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

// The wind lookup only uses `fract(world.x)`, and after a long drag float32 would lose
// that fraction of an unwrapped X — so wrap the origin here, in doubles.
export const viewMin = ([minX, minY]) => [minX - Math.floor(minX), minY];

// One line segment per particle, two vertices each: gl_VertexID >> 1 is the index into
// the state texture, & 1 picks the end — 0 trails behind the current position by the
// step the particle just took. Everything needed is in the state, so no wind lookup.

export const drawVert = `#version 300 es
precision highp float;

uniform sampler2D u_particles;
uniform int u_particles_res;
uniform vec2 u_resolution;

out float v_speed_t;

void main() {
    int i = gl_VertexID >> 1;
    vec4 state = texelFetch(u_particles, ivec2(
        i % u_particles_res,
        i / u_particles_res), 0);

    vec2 packed = unpackHalf2x16(floatBitsToUint(state.b));
    // exactly zero means no step to draw — the seeding frame, or air so still it encodes as calm.
    // Collapse the segment off-screen rather than stretching it to the minimum below, which would
    // otherwise light up every particle of a freshly seeded field with a dash.
    if (packed == vec2(0)) {
        gl_Position = vec4(2, 2, 2, 1);
        return;
    }

    // stretch to a pixel: shorter segments rasterize to nothing, dropping slow particles
    vec2 offset = packed * u_resolution;
    float len = length(offset);
    if (len < 1.0) offset /= len;

    vec2 p = state.rg - offset / u_resolution * float(1 - (gl_VertexID & 1));

    v_speed_t = state.a;

    gl_Position = vec4(2.0 * p.x - 1.0, 1.0 - 2.0 * p.y, 0, 1);
}`;

export const drawFrag = `#version 300 es
precision mediump float;

uniform sampler2D u_color_ramp;

in float v_speed_t;

out vec4 fragColor;

void main() {
    fragColor = texture(u_color_ramp, vec2(v_speed_t, 0.5));
}`;

// A full-screen quad, shared by the screen and update programs below: drawn as a
// 4-vertex triangle strip, gl_VertexID gives (0,0) (1,0) (0,1) (1,1).

export const quadVert = `#version 300 es
precision mediump float;

out vec2 v_tex_pos;

void main() {
    v_tex_pos = vec2(gl_VertexID & 1, gl_VertexID >> 1);
    gl_Position = vec4(2.0 * v_tex_pos - 1.0, 0, 1);
}`;

// Draws the previous frame's screen texture, fading it out. highp because in mediump the
// ulp at 4K gl_FragCoord values is 4, and the dither below would degenerate into banding.

export const screenFrag = `#version 300 es
precision highp float;

uniform sampler2D u_screen;
uniform float u_opacity;
uniform float u_dither_seed;

// where this pixel's ground was in the texture: a gather, so it's the inverse of the particle
// rebase. Identity when the texture is already in the current view, as the final composite is.
uniform vec2 u_trail_scale;
uniform vec2 u_trail_offset;

in vec2 v_tex_pos;

out vec4 fragColor;

void main() {
    vec2 pos = v_tex_pos * u_trail_scale + u_trail_offset;
    // explicitly transparent outside, because CLAMP_TO_EDGE would instead repeat the edge texel
    // and stretch a bright streak of it across everything the view has just revealed
    if (any(lessThan(pos, vec2(0))) || any(greaterThan(pos, vec2(1)))) {
        fragColor = vec4(0);
        return;
    }
    vec4 faded = texture(u_screen, pos) * u_opacity;
    // ±0.5/255 of R2 noise makes the rounding unbiased, so a fade of a fraction of a level isn't lost.
    // Zero seed means nothing to fade; sign() keeps black black, as clamping the negative half of the
    // noise would rectify it into a haze that never fades.
    float dither = u_dither_seed > 0.0 ? fract(dot(gl_FragCoord.xy, vec2(0.7548777, 0.5698403)) + u_dither_seed) - 0.5 : 0.0;
    fragColor = faded + dither / 255.0 * sign(faded);
}`;

// Advances every particle by one simulation step, writing the new state into the other
// state texture: the new position in rg, the step it just took packed into b as two
// half floats, and its wind speed in a.

export const updateFrag = `#version 300 es
precision highp float;

uniform sampler2D u_wind;
uniform vec2 u_wind_res;
uniform float u_wind_step;

// the view rect, as a Mercator origin and span; u_view_min.x arrives pre-wrapped into [0, 1)
// because an unwrapped X can be far enough out that float32 loses the fraction of a world
uniform vec2 u_view_min;
uniform vec2 u_view_span;

// maps a position stored against the previous view into the current one; computed in JS doubles
// and applied view-locally, since going through a global Mercator coordinate would round away
// more than the whole visible span at high zoom
uniform vec2 u_rebase_scale;
uniform vec2 u_rebase_offset;
uniform float u_keep; // fraction of the particles the rebase leaves in place; see below
uniform float u_reseed; // scatter every particle instead of rebasing: first frame, or no shared ground

// the ground the view change just revealed, as rects with the cumulative area fractions to pick
// between them, and their total area — zero when nothing was revealed, i.e. a still or zooming-in view
uniform vec4 u_reveal[4];
uniform vec4 u_reveal_cdf;
uniform float u_reveal_total;

uniform sampler2D u_particles;
uniform float u_rand_seed;
uniform float u_dt;
uniform float u_speed_dt; // CSS px of screen travel per m/s of wind, over this frame
uniform vec2 u_canvas_css;
uniform float u_ramp_max_speed;
uniform float u_life_rate; // 1/s — hazard of recycling per second of age
uniform float u_travel_rate; // 1/px — hazard of recycling per CSS px travelled

out vec4 fragColor;

const float PI = 3.141592653589793;

// pseudo-random generator
const vec3 rand_constants = vec3(12.9898, 78.233, 4375.85453);
float rand(const vec2 co) {
    float t = dot(rand_constants.xy, co);
    return fract(sin(t) * (rand_constants.z + t));
}

bool outside(const vec2 p) {
    return any(lessThan(p, vec2(0))) || any(greaterThan(p, vec2(1)));
}

// A random point on the view's border with the inward normal there, as (pos, normal). Edges are
// picked by their length in px, not in view units, so a wide canvas draws proportionally more.
vec4 boundary_point(const vec2 seed) {
    float horizontal = u_canvas_css.x / (u_canvas_css.x + u_canvas_css.y);
    float far = step(0.5, rand(seed + 0.7)); // 0 picks the top or left edge, 1 the opposite one
    float along = rand(seed + 1.9);
    if (rand(seed) < horizontal) return vec4(along, far, 0.0, 1.0 - 2.0 * far);
    return vec4(far, along, 1.0 - 2.0 * far, 0.0);
}

// manual bilinear blend: hardware filtering uses low-precision weights on many GPUs,
// which stair-steps the trails
vec2 lookup_wind(const vec2 uv) {
    vec2 px = 1.0 / u_wind_res;
    vec2 t = uv * u_wind_res - 0.5;
    vec2 f = fract(t);
    vec2 vc = (floor(t) + 0.5) * px;
    vec2 tl = texture(u_wind, vc).rg;
    vec2 tr = texture(u_wind, vc + vec2(px.x, 0)).rg;
    vec2 bl = texture(u_wind, vc + vec2(0, px.y)).rg;
    vec2 br = texture(u_wind, vc + px).rg;
    return mix(mix(tl, tr, f.x), mix(bl, br, f.x), f.y);
}

// This frame's step at a view-relative position, in screen px, with the color ramp position
// alongside it: the ramp wants the ground speed, which the px conversion has already scaled away.
vec3 wind_step_px(const vec2 p) {
    // positions are stored relative to the view, so this is the only place a global coordinate
    // appears — and only to be looked up, never stored back: float32 is ample against a ~1° grid
    // but at high zoom the whole visible span is a few ulps of a world coordinate
    vec2 world = u_view_min + p * u_view_span;

    // inverting Mercator, but stopping at sinh: the wind row wants the latitude while the scale
    // factor wants cosh of the same argument, so one sinh serves both and only the row pays atan
    float sinh_lat = sinh(PI * (1.0 - 2.0 * world.y));
    float cos_lat = inversesqrt(1.0 + sinh_lat * sinh_lat);

    // affine, so decoding after the blend is exact — see src/encode.js. The grid stays
    // equirectangular on disk: reprojecting it would cost equator detail or bloat the poles.
    vec2 uv = vec2(fract(world.x), 0.5 - atan(sinh_lat) / PI);
    vec2 velocity = (lookup_wind(uv) * 255.0 - 128.0) * u_wind_step;

    // Mercator is conformal, so its stretch is one isotropic scalar on the ground velocity rather
    // than the equirectangular fix to x alone. Speed is in screen px, which is what keeps the field
    // reading the same at every zoom — the latitude term stays physical, so shape survives too.
    // The ramp clamps past its own end, so no clamp here.
    return vec3(vec2(velocity.x, -velocity.y) / cos_lat * u_speed_dt,
        length(velocity) / u_ramp_max_speed);
}

// A point on the border where wind is entering the view, drawn in proportion to how fast it enters
// there — or (-1) if a few tries didn't find one, which is the answer on a border with no inflow at
// all. Rejection is the whole trick: accepting against a uniform fraction of the fastest step the
// ramp can show makes the acceptance rate the inflow flux itself, so no reduction pass is needed to
// normalize it. Candidates are cheap because the wind lookup is the only real cost.
vec2 inflow_point(const vec2 seed) {
    float max_step = u_ramp_max_speed * u_speed_dt; // px a ramp-topping wind covers this frame
    for (int k = 0; k < 4; k++) {
        vec2 s = seed + float(k) * 11.7;
        vec4 edge = boundary_point(s);
        if (dot(wind_step_px(edge.xy).xy, edge.zw) > rand(s + 3.1) * max_step) return edge.xy;
    }
    return vec2(-1.0);
}

void main() {
    // integer state addressing: exact at any state texture size, and it hands the hash below a
    // coordinate that's unique per particle rather than one interpolated across the quad
    ivec2 statePos = ivec2(gl_FragCoord.xy);
    vec2 seed = vec2(statePos) + vec2(u_rand_seed, u_rand_seed * 1.6180339);

    // an early return rather than folding into the drop below: seeding is the same operation, but a
    // uniform branch is coherent and skips a wind lookup on the one frame whose state is meaningless
    if (u_reseed > 0.0) {
        fragColor = vec4(rand(seed), rand(seed + 1.3), 0.0, 0.0);
        return;
    }

    // rebase from the view the state was written against; the step below then lands in current-view
    // units, so what gets stored as the segment holds wind only and never any camera movement
    vec2 pos = texelFetch(u_particles, statePos, 0).rg * u_rebase_scale + u_rebase_offset;

    // the rebase alone put these outside: exactly the ground the view has just left behind, so there
    // are as many of them as the revealed strip needs. Wind-driven escapes below are a different
    // thing and belong anywhere, which is why the two are counted apart.
    float displaced = float(outside(pos));

    vec3 wind = wind_step_px(pos);
    float speed_t = wind.z;
    vec2 offset = wind.xy / u_canvas_css;
    pos += offset;

    // chance of restarting at a random position, so the field can't degenerate. Two
    // independent Poisson hazards, one in time and one in distance travelled: the first
    // keeps calm air turning over, the second evens out density as flow concentrates
    // particles. A zero rate disables its hazard.
    float survival = exp(-(u_dt * u_life_rate + length(wind.xy) * u_travel_rate));
    // a particle carried out of the view is gone for good, so it respawns too: the view is no
    // longer the whole world, and wrapping it would fold the far edge back into the picture
    float escaped = float(outside(pos));

    // Zooming out shrinks the whole field into a box of the new view, and nothing escapes, so the
    // ordinary hazards would need several turnovers to spread it out again — meanwhile the old view
    // sits there as a bright rectangle. Instead thin the survivors to the density the box now
    // represents: u_keep is its area in current-view units, so this scatters exactly the surplus.
    float crowded = step(u_keep, rand(seed + 3.7));

    float drop = max(max(escaped, crowded), step(survival, rand(seed)));

    vec2 random_pos = vec2(rand(seed + 1.3), rand(seed + 2.1));

    // A displaced or surplus particle isn't just any respawn: the view change moved it, and the
    // deficit it should cover is the ground that change revealed, not the view as a whole. Filling
    // the revealed part elsewhere leaves a visible seam for a whole turnover — the old view's edge
    // stays legible in the density. So those two respawn inside the revealed rects, picked by area,
    // while the hazards keep scattering anywhere, which is where they're already in equilibrium.
    if (u_reveal_total > 0.0 && max(displaced, crowded) > 0.0) {
        float r = rand(seed + 5.1);
        int i = r < u_reveal_cdf.x ? 0 : r < u_reveal_cdf.y ? 1 : r < u_reveal_cdf.z ? 2 : 3;
        random_pos = mix(u_reveal[i].xy, u_reveal[i].zw, random_pos);

    } else if (escaped > displaced) {
        // A particle the *wind* blew out of the view left through the border, so it comes back through
        // the border: the view is an open domain, and putting it anywhere instead leaves the strip
        // along every inflow edge depleted, since there advection carries particles inward and nothing
        // upstream replaces them. Matching the two makes border flux balance — out through the outflow
        // edges, in through the inflow ones, in proportion to how fast wind enters each.
        //
        // Strictly the wind-driven escapes, hence the comparison: a particle the rebase put outside is
        // also outside, but it has no border crossing to balance. Zooming in displaces everything that
        // magnified past the edges, which is a large share of the field and reveals nothing, so
        // treating those as blown out would dump most of the field into a thin strip at once.
        vec2 inflow = inflow_point(seed + 8.3);
        if (inflow.x >= 0.0) random_pos = inflow;
    }

    // The step has to be resampled where the particle landed, not carried over or zeroed: the stale one
    // would streak from the old position to the new, and a zero one draws nothing at all, which costs a
    // segment per respawn. A view change respawns in bulk, so that shortfall reads as dimming for as
    // long as the gesture lasts. The extra wind lookup is only paid by the few percent that dropped.
    if (drop > 0.0) {
        pos = random_pos;
        vec3 respawn_wind = wind_step_px(pos);
        offset = respawn_wind.xy / u_canvas_css;
        speed_t = respawn_wind.z;
    }

    // half floats resolve the step to a fraction of a pixel
    float packed_offset = uintBitsToFloat(packHalf2x16(offset));

    fragColor = vec4(pos, packed_offset, speed_t);
}`;

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

    // stretch to a pixel: shorter segments rasterize to nothing, dropping slow particles
    vec2 offset = unpackHalf2x16(floatBitsToUint(state.b)) * u_resolution;
    float len = length(offset);
    if (len < 1.0) offset = len > 0.0 ? offset / len : vec2(1, 0);

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

// Draws the previous frame's screen texture, fading it out.

export const screenFrag = `#version 300 es
precision mediump float;

uniform sampler2D u_screen;
uniform float u_opacity;

in vec2 v_tex_pos;

out vec4 fragColor;

void main() {
    vec4 color = texture(u_screen, v_tex_pos);
    // a hack to guarantee opacity fade out even with a value close to 1.0
    fragColor = vec4(floor(255.0 * color * u_opacity) / 255.0);
}`;

// Advances every particle by one simulation step, writing the new state into the other
// state texture: the new position in rg, the step it just took packed into b as two
// half floats, and its wind speed in a.

export const updateFrag = `#version 300 es
precision highp float;

uniform sampler2D u_wind;
uniform vec2 u_wind_res;
uniform float u_wind_step;

uniform sampler2D u_particles;
uniform float u_rand_seed;
uniform float u_speed_factor;
uniform float u_drop_rate;
uniform float u_drop_rate_bump;

in vec2 v_tex_pos;

out vec4 fragColor;

// pseudo-random generator
const vec3 rand_constants = vec3(12.9898, 78.233, 4375.85453);
float rand(const vec2 co) {
    float t = dot(rand_constants.xy, co);
    return fract(sin(t) * (rand_constants.z + t));
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

void main() {
    vec2 pos = texture(u_particles, v_tex_pos).rg;

    // affine, so decoding after the blend is exact — see src/encode.js
    vec2 velocity = (lookup_wind(pos) * 255.0 - 128.0) * u_wind_step;
    // 0..1 fraction of the encodable range, for coloring
    float speed_t = length(velocity) / (u_wind_step * 127.0);

    // take EPSG:4326 distortion into account for calculating where the particle moved
    float distortion = cos(radians(pos.y * 180.0 - 90.0));
    vec2 offset = vec2(velocity.x / distortion, -velocity.y) * 0.0001 * u_speed_factor;

    // update particle position, wrapping around the date line
    pos = fract(1.0 + pos + offset);

    vec2 seed = (pos + v_tex_pos) * u_rand_seed;

    // chance of restarting at a random position, so the field can't degenerate
    float drop_rate = u_drop_rate + speed_t * u_drop_rate_bump;
    float drop = step(1.0 - drop_rate, rand(seed));

    vec2 random_pos = vec2(
        rand(seed + 1.3),
        rand(seed + 2.1));

    pos = mix(pos, random_pos, drop);

    // half floats resolve the offset to a fraction of a pixel. Zeroed on a drop, so that
    // particle draws no segment; un-wrapped, so a date line crossing runs off the edge
    // rather than back across the screen.
    float packed_offset = uintBitsToFloat(packHalf2x16(offset * (1.0 - drop)));

    fragColor = vec4(pos, packed_offset, speed_t);
}`;

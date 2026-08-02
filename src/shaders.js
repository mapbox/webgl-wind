// The particle-drawing program: one point per particle, colored by wind speed.
// Positions come straight out of the particle state texture — no vertex attributes,
// the point index is gl_VertexID.

export const drawVert = `#version 300 es
precision mediump float;

uniform sampler2D u_particles;
uniform int u_particles_res;

out vec2 v_particle_pos;

void main() {
    v_particle_pos = texelFetch(u_particles, ivec2(
        gl_VertexID % u_particles_res,
        gl_VertexID / u_particles_res), 0).rg;

    gl_PointSize = 1.0;
    gl_Position = vec4(2.0 * v_particle_pos.x - 1.0, 1.0 - 2.0 * v_particle_pos.y, 0, 1);
}`;

export const drawFrag = `#version 300 es
precision mediump float;

uniform sampler2D u_wind;
uniform vec2 u_wind_min;
uniform vec2 u_wind_max;
uniform sampler2D u_color_ramp;

in vec2 v_particle_pos;

out vec4 fragColor;

void main() {
    vec2 velocity = mix(u_wind_min, u_wind_max, texture(u_wind, v_particle_pos).rg);
    float speed_t = length(velocity) / length(u_wind_max);

    fragColor = texture(u_color_ramp, vec2(speed_t, 0.5));
}`;

// A full-screen quad, shared by the screen and update programs below. Drawn as a
// 4-vertex triangle strip with no attributes: gl_VertexID gives (0,0) (1,0) (0,1) (1,1).

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

// Advances every particle by one simulation step. Positions live in an RG32F texture,
// so they're read and written as plain floats.

export const updateFrag = `#version 300 es
precision highp float;

uniform sampler2D u_particles;
uniform sampler2D u_wind;
uniform vec2 u_wind_res;
uniform vec2 u_wind_min;
uniform vec2 u_wind_max;
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

// wind speed lookup; blend 4 neighbouring texels in highp, since hardware filtering
// uses low-precision weights on many GPUs, which stair-steps the trails
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

    vec2 velocity = mix(u_wind_min, u_wind_max, lookup_wind(pos));
    float speed_t = length(velocity) / length(u_wind_max);

    // take EPSG:4236 distortion into account for calculating where the particle moved
    float distortion = cos(radians(pos.y * 180.0 - 90.0));
    vec2 offset = vec2(velocity.x / distortion, -velocity.y) * 0.0001 * u_speed_factor;

    // update particle position, wrapping around the date line
    pos = fract(1.0 + pos + offset);

    // a random seed to use for the particle drop
    vec2 seed = (pos + v_tex_pos) * u_rand_seed;

    // drop rate is a chance a particle will restart at random position, to avoid degeneration
    float drop_rate = u_drop_rate + speed_t * u_drop_rate_bump;
    float drop = step(1.0 - drop_rate, rand(seed));

    vec2 random_pos = vec2(
        rand(seed + 1.3),
        rand(seed + 2.1));

    fragColor = vec4(mix(pos, random_pos, drop), 0, 1);
}`;

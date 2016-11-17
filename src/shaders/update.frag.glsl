precision mediump float;

uniform sampler2D u_wind;
uniform vec2 u_wind_tex_scale;
uniform float u_wind_tex_size;
uniform sampler2D u_particles;
uniform float u_rand_seed;

varying vec2 v_position;

vec2 encode(const float value) {
    float v = value * 255.0 * 255.0;
    return vec2(mod(v, 255.0), floor(v / 255.0)) / 255.0;
}
float decode(const vec2 channels) {
    return dot(channels, vec2(255.0, 255.0 * 255.0)) / (255.0 * 255.0);
}
float rand(vec2 co) {
    float t = 12.9898 * co.x + 78.233 * co.y;
    return fract(sin(t) * (4375.85453 + t));
}

vec2 lookup_wind(vec2 uv) {
    // manual bilinear filtering below for smoothness
    float px = 1.0 / u_wind_tex_size;
    vec2 vc = (floor(uv * u_wind_tex_scale)) * px;
    vec2 f = fract(uv * u_wind_tex_scale);
    vec2 tl = texture2D(u_wind, vc).rg;
    vec2 tr = texture2D(u_wind, vc + vec2(px, 0)).rg;
    vec2 bl = texture2D(u_wind, vc + vec2(0, px)).rg;
    vec2 br = texture2D(u_wind, vc + vec2(px, px)).rg;
    // return texture2D(u_wind, uv * u_wind_tex_scale / u_wind_tex_size).rg; // hardware filtering
    return mix(mix(tl, tr, f.x), mix(bl, br, f.x), f.y);
}
void main() {
    vec4 particle_sample = texture2D(u_particles, v_position);
    vec2 particle_pos = vec2(decode(particle_sample.rg), decode(particle_sample.ba));

    vec2 seed = (particle_pos + v_position) * u_rand_seed;
    if (rand(seed) < 0.995) {
        vec2 speed = (lookup_wind(particle_pos) * 67.0) - 30.0;
        particle_pos = mod(1.0 + particle_pos + speed * 0.00001, 1.0);
    } else {
        particle_pos = vec2(rand(seed + 1.3), rand(seed + 2.1));
    }

    gl_FragColor = vec4(encode(particle_pos.x), encode(particle_pos.y));
}

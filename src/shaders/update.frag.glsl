precision mediump float;

uniform sampler2D wind;
uniform sampler2D particles;
uniform vec2 wind_tex_scale;
uniform float wind_tex_size;

varying vec2 pos;

vec2 encode(const float value) {
    float v = value * 255.0 * 255.0;
    return vec2(mod(v, 255.0), floor(v / 255.0)) / 255.0;
}
float decode(const vec2 channels) {
    return dot(channels, vec2(255.0, 255.0 * 255.0)) / (255.0 * 255.0);
}

vec2 lookup_wind(vec2 uv) {
    // manual bilinear filtering below for smoothness
    float px = 1.0 / wind_tex_size;
    vec2 vc = (floor(uv * wind_tex_scale)) * px;
    vec2 f = fract(uv * wind_tex_scale);
    vec2 tl = texture2D(wind, vc).rg;
    vec2 tr = texture2D(wind, vc + vec2(px, 0)).rg;
    vec2 bl = texture2D(wind, vc + vec2(0, px)).rg;
    vec2 br = texture2D(wind, vc + vec2(px, px)).rg;
    // return texture2D(wind, uv * wind_tex_scale / wind_tex_size).rg; // hardware filtering
    return mix(mix(tl, tr, f.x), mix(bl, br, f.x), f.y);
}
void main() {
    vec4 particle_sample = texture2D(particles, pos);
    vec2 particle_pos = vec2(decode(particle_sample.rg), decode(particle_sample.ba));

    vec2 speed = (lookup_wind(particle_pos) * 67.0) - 30.0;
    particle_pos = mod(1.0 + particle_pos + speed * 0.00002, 1.0);

    gl_FragColor = vec4(encode(particle_pos.x), encode(particle_pos.y));
}

precision mediump float;

uniform sampler2D u_particles;
uniform sampler2D u_wind;
uniform vec2 u_wind_res;
uniform vec2 u_wind_min;
uniform vec2 u_wind_max;
uniform float u_rand_seed;

varying vec2 v_tex_pos;

float rand(const vec2 co) {
    float t = 12.9898 * co.x + 78.233 * co.y;
    return fract(sin(t) * (4375.85453 + t));
}

vec2 lookup_wind(const vec2 uv) {
    // return texture2D(u_wind, uv).rg; // hardware filtering
    vec2 px = 1.0 / u_wind_res;
    vec2 vc = (floor(uv * u_wind_res)) * px;
    vec2 f = fract(uv * u_wind_res);
    vec2 tl = texture2D(u_wind, vc).rg;
    vec2 tr = texture2D(u_wind, vc + vec2(px.x, 0)).rg;
    vec2 bl = texture2D(u_wind, vc + vec2(0, px.y)).rg;
    vec2 br = texture2D(u_wind, vc + px).rg;
    return mix(mix(tl, tr, f.x), mix(bl, br, f.x), f.y); // manual bilinear filtering for smoothness
}

void main() {
    vec4 color = texture2D(u_particles, v_tex_pos);
    vec2 pos = vec2(color.r / 255.0 + color.g, color.b / 255.0 + color.a);

    vec2 velocity = u_wind_min + (u_wind_max - u_wind_min) * lookup_wind(pos);
    float speed_t = length(velocity) / length(u_wind_max);

    float dx = velocity.x / max(0.1, cos(3.1415926536 * (pos.y - 0.5)));
    vec2 offset = vec2(dx, -velocity.y) * 0.00002;

    vec2 seed = (pos + v_tex_pos) * u_rand_seed;

    pos = rand(seed) < 0.997 - speed_t * 0.01
        ? fract(1.0 + pos + offset)
        : vec2(rand(seed + 1.3), rand(seed + 2.1));

    gl_FragColor = vec4(
        fract(pos.x * 255.0), floor(pos.x * 255.0) / 255.0,
        fract(pos.y * 255.0), floor(pos.y * 255.0) / 255.0);
}

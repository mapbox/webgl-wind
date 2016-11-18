precision highp float;

uniform sampler2D u_wind;
uniform vec2 u_wind_tex_scale;
uniform float u_wind_tex_size;
uniform vec2 u_wind_min;
uniform vec2 u_wind_max;
uniform sampler2D u_color_ramp;

varying vec2 particle_pos;

vec2 lookup_wind(const vec2 uv) {
    return texture2D(u_wind, uv * u_wind_tex_scale / u_wind_tex_size).rg;
}

void main() {
    vec2 velocity = u_wind_min + (u_wind_max - u_wind_min) * lookup_wind(particle_pos);
    float speed_t = length(velocity) / length(u_wind_max);

    float x = mod(512.0 * speed_t, 16.0) / 16.0;
    float y = floor(512.0 * speed_t / 16.0) / 16.0;

    gl_FragColor = texture2D(u_color_ramp, vec2(x, y));
}

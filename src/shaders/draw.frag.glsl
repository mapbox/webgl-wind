precision mediump float;

uniform sampler2D u_wind;
uniform vec2 u_wind_min;
uniform vec2 u_wind_max;
uniform sampler2D u_color_ramp;

varying vec2 v_particle_pos;

void main() {
    vec2 velocity = u_wind_min + (u_wind_max - u_wind_min) * texture2D(u_wind, v_particle_pos).rg;
    float speed_t = length(velocity) / length(u_wind_max);

    float x = mod(512.0 * speed_t, 16.0) / 16.0;
    float y = floor(512.0 * speed_t / 16.0) / 16.0;

    gl_FragColor = texture2D(u_color_ramp, vec2(x, y));
}

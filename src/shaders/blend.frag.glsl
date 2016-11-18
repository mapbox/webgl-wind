precision mediump float;

uniform sampler2D u_background;
uniform sampler2D u_foreground;

varying vec2 v_position;

float darken(const float c) {
    return max(0.0, c - 0.01);
}

void main() {
    vec4 b = texture2D(u_background, 1.0 - v_position);
    vec4 c = texture2D(u_foreground, 1.0 - v_position);
    gl_FragColor = length(c.rgb) > 0.0 ? c : vec4(darken(b.r), darken(b.g), darken(b.b), 1);
}

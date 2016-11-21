precision mediump float;

uniform sampler2D u_screen;
uniform float u_opacity;

varying vec2 v_position;

void main() {
    gl_FragColor = texture2D(u_screen, 1.0 - v_position) * u_opacity;
}

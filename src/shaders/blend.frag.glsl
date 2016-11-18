precision mediump float;

uniform sampler2D u_background;
uniform sampler2D u_foreground;

varying vec2 v_position;

void main() {
    vec4 c1 = texture2D(u_background, 1.0 - v_position);
    vec4 c2 = texture2D(u_foreground, 1.0 - v_position);
    gl_FragColor = length(c2.rgb) > 0.0 ? c2 : vec4(c1.rgb * 0.97, 1);
}

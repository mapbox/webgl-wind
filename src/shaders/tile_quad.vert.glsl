precision mediump float;

uniform vec4 u_offset_scale;

attribute vec2 a_pos;

varying vec2 v_tex_pos;

void main() {
    vec2 uv = a_pos / u_offset_scale.zw - u_offset_scale.xy;
    v_tex_pos = vec2(1.0 - uv.x, uv.y);
    gl_Position = vec4(2.0 * a_pos - 1.0, 0, 1);
}

precision mediump float;

attribute vec2 position;
varying vec2 pos;

void main() {
    pos = position;
    gl_Position = vec4(1.0 - 2.0 * position, 0, 1);
}

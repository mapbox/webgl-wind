precision mediump float;

attribute float a_index;

uniform sampler2D u_particles;
uniform float u_particles_tex_size;

varying vec2 v_particle_pos;

void main() {
    float x = mod(a_index, u_particles_tex_size);
    float y = floor(a_index / u_particles_tex_size);
    vec4 color = texture2D(u_particles, vec2(x, y) / u_particles_tex_size);
    v_particle_pos = vec2(color.r / 255.0 + color.g, color.b / 255.0 + color.a);

    gl_PointSize = 1.0;
    gl_Position = vec4(1.0 - 2.0 * vec2(1.0 - v_particle_pos.x, v_particle_pos.y), 0, 1);
}

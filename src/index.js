
import * as util from './util';

import drawVert from './shaders/draw.vert.glsl';
import drawFrag from './shaders/draw.frag.glsl';

import quadVert from './shaders/quad.vert.glsl';

import screenFrag from './shaders/screen.frag.glsl';
import updateFrag from './shaders/update.frag.glsl';

const defaultRampColors = {
    0.0: '#3288bd',
    0.1: '#66c2a5',
    0.2: '#abdda4',
    0.3: '#e6f598',
    0.4: '#fee08b',
    0.5: '#fdae61',
    0.6: '#f46d43',
    1.0: '#d53e4f'
};

export default class WindGL {
    constructor(gl) {
        this.gl = gl;

        this.fadeOpacity = 0.996; // how fast the particle trails fade on each frame
        this.speedFactor = 0.25; // how fast the particles move
        this.dropRate = 0.003; // how often the particles move to a random place
        this.dropRateBump = 0.01; // drop rate increase relative to individual particle speed
        this.numParticles = 65536;

        this.drawProgram = util.createProgram(gl, drawVert, drawFrag);
        this.screenProgram = util.createProgram(gl, quadVert, screenFrag);
        this.updateProgram = util.createProgram(gl, quadVert, updateFrag);

        this.quadBuffer = util.createBuffer(gl, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]));
        this.framebuffer = gl.createFramebuffer();

        this.setColorRamp(defaultRampColors);
        this.setView([0, 0, 1, 1]);
        this.resize();
    }

    resize() {
        const gl = this.gl;
        const emptyPixels = new Uint8Array(gl.canvas.width * gl.canvas.height * 4);
        // screen textures to hold the drawn screen for the previous and the current frame
        this.backgroundTexture = util.createTexture(gl, gl.NEAREST, emptyPixels, gl.canvas.width, gl.canvas.height);
        this.screenTexture = util.createTexture(gl, gl.NEAREST, emptyPixels, gl.canvas.width, gl.canvas.height);
    }

    setColorRamp(colors) {
        // lookup texture for colorizing the particles according to their speed
        this.colorRampTexture = util.createTexture(this.gl, this.gl.LINEAR, getColorRamp(colors), 16, 16);
    }

    set numParticles(numParticles) {
        const gl = this.gl;

        // we create a square texture where each pixel will hold a particle position encoded as RGBA
        const particleRes = this.particleStateResolution = Math.ceil(Math.sqrt(numParticles));
        this._numParticles = particleRes * particleRes;

        const particleState = new Uint8Array(this._numParticles * 4);
        for (let i = 0; i < particleState.length; i++) {
            particleState[i] = Math.floor(Math.random() * 256); // randomize the initial particle positions
        }
        // textures to hold the particle state for the current and the next frame
        this.particleStateTexture0 = util.createTexture(gl, gl.NEAREST, particleState, particleRes, particleRes);
        this.particleStateTexture1 = util.createTexture(gl, gl.NEAREST, particleState, particleRes, particleRes);

        const particleIndices = new Float32Array(this._numParticles);
        for (let i = 0; i < this._numParticles; i++) particleIndices[i] = i;
        this.particleIndexBuffer = util.createBuffer(gl, particleIndices);
    }
    get numParticles() {
        return this._numParticles;
    }

    setWind(data, image) {
        this.windData = data;
        this.windTexture = util.createTexture(this.gl, this.gl.LINEAR, image);
    }

    setView(bbox, matrix) {
        this.bbox = bbox;

        if (matrix) {
            this.matrix = matrix;

        } else {
            const minX = bbox[0];
            const minY = mercY(bbox[3]);
            const maxX = bbox[2];
            const maxY = mercY(bbox[1]);

            const kx = 2 / (maxX - minX);
            const ky = 2 / (maxY - minY);

            this.matrix = new Float32Array([kx, 0, 0, 0, 0, ky, 0, 0, 0, 0, 1, 0, -1 - minX * kx, -1 - minY * ky, 0, 1]);
        }
    }

    draw() {
        const gl = this.gl;
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.STENCIL_TEST);

        util.bindTexture(gl, this.windTexture, 0);
        util.bindTexture(gl, this.particleStateTexture0, 1);

        this.drawScreen();
        this.updateParticles();
    }

    drawScreen() {
        const gl = this.gl;
        // draw the screen into a temporary framebuffer to retain it as the background on the next frame
        util.bindFramebuffer(gl, this.framebuffer, this.screenTexture);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        this.drawTexture(this.backgroundTexture, this.fadeOpacity);
        this.drawParticles();

        util.bindFramebuffer(gl, null);
        // enable blending to support drawing on top of an existing background (e.g. a map)
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        this.drawTexture(this.screenTexture, 1.0);
        gl.disable(gl.BLEND);

        // save the current screen as the background for the next frame
        const temp = this.backgroundTexture;
        this.backgroundTexture = this.screenTexture;
        this.screenTexture = temp;
    }

    drawTexture(texture, opacity) {
        const gl = this.gl;
        const program = this.screenProgram;
        gl.useProgram(program.program);

        util.bindAttribute(gl, this.quadBuffer, program.a_pos, 2);
        util.bindTexture(gl, texture, 2);
        gl.uniform1i(program.u_screen, 2);
        gl.uniform1f(program.u_opacity, opacity);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    drawParticles() {
        const gl = this.gl;
        const program = this.drawProgram;
        gl.useProgram(program.program);

        util.bindAttribute(gl, this.particleIndexBuffer, program.a_index, 1);
        util.bindTexture(gl, this.colorRampTexture, 2);

        gl.uniform1i(program.u_wind, 0);
        gl.uniform1i(program.u_particles, 1);
        gl.uniform1i(program.u_color_ramp, 2);

        gl.uniform1f(program.u_particles_res, this.particleStateResolution);
        gl.uniform2f(program.u_wind_min, this.windData.uMin, this.windData.vMin);
        gl.uniform2f(program.u_wind_max, this.windData.uMax, this.windData.vMax);
        gl.uniformMatrix4fv(program.u_matrix, false, this.matrix);
        gl.uniform4fv(program.u_bbox, this.bbox);

        gl.drawArrays(gl.POINTS, 0, this._numParticles);
    }

    updateParticles() {
        const gl = this.gl;
        util.bindFramebuffer(gl, this.framebuffer, this.particleStateTexture1);
        gl.viewport(0, 0, this.particleStateResolution, this.particleStateResolution);

        const program = this.updateProgram;
        gl.useProgram(program.program);

        util.bindAttribute(gl, this.quadBuffer, program.a_pos, 2);

        gl.uniform1i(program.u_wind, 0);
        gl.uniform1i(program.u_particles, 1);

        gl.uniform1f(program.u_rand_seed, Math.random());
        gl.uniform2f(program.u_wind_res, this.windData.width, this.windData.height);
        gl.uniform2f(program.u_wind_min, this.windData.uMin, this.windData.vMin);
        gl.uniform2f(program.u_wind_max, this.windData.uMax, this.windData.vMax);
        gl.uniform1f(program.u_speed_factor, this.speedFactor);
        gl.uniform1f(program.u_drop_rate, this.dropRate);
        gl.uniform1f(program.u_drop_rate_bump, this.dropRateBump);
        gl.uniform4fv(program.u_bbox, this.bbox);

        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // swap the particle state textures so the new one becomes the current one
        const temp = this.particleStateTexture0;
        this.particleStateTexture0 = this.particleStateTexture1;
        this.particleStateTexture1 = temp;
    }
}

function getColorRamp(colors) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = 256;
    canvas.height = 1;

    const gradient = ctx.createLinearGradient(0, 0, 256, 0);
    for (const stop in colors) {
        gradient.addColorStop(+stop, colors[stop]);
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 1);

    return new Uint8Array(ctx.getImageData(0, 0, 256, 1).data);
}

function mercY(y) {
    const s = Math.sin(Math.PI * (y - 0.5));
    const y2 = 1.0 - (Math.log((1.0 + s) / (1.0 - s)) / (2 * Math.PI) + 1.0) / 2.0;
    return y2 < 0 ? 0 :
           y2 > 1 ? 1 : y2;
}

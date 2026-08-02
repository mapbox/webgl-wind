import * as util from './util.js';
import {drawVert, drawFrag, quadVert, screenFrag, updateFrag} from './shaders.js';

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

        // needed to render into the RG32F particle state textures
        if (!gl.getExtension('EXT_color_buffer_float')) {
            throw new Error('WebGL2 EXT_color_buffer_float is required');
        }

        this.fadeOpacity = 0.996; // how fast the particle trails fade on each frame
        this.speedFactor = 0.25; // how fast the particles move
        this.dropRate = 0.003; // how often the particles move to a random place
        this.dropRateBump = 0.01; // drop rate increase relative to individual particle speed

        this.drawProgram = util.createProgram(gl, drawVert, drawFrag);
        this.screenProgram = util.createProgram(gl, quadVert, screenFrag);
        this.updateProgram = util.createProgram(gl, quadVert, updateFrag);

        this.quadBuffer = util.createBuffer(gl, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]));

        // a_pos is bound to location 0 in the shader, so one VAO feeds both quad programs
        this.quadVAO = gl.createVertexArray();
        gl.bindVertexArray(this.quadVAO);
        util.bindAttribute(gl, this.quadBuffer, 0, 2);

        // the particle draw program has no attributes at all — it indexes the state
        // texture by gl_VertexID — but it still needs a VAO with nothing enabled
        this.particleVAO = gl.createVertexArray();
        gl.bindVertexArray(null);

        this.framebuffer = gl.createFramebuffer();

        this.setColorRamp(defaultRampColors);
        this.resize();
    }

    resize() {
        const gl = this.gl;
        gl.deleteTexture(this.backgroundTexture);
        gl.deleteTexture(this.screenTexture);
        // screen textures to hold the drawn screen for the previous and the current frame
        this.backgroundTexture = util.createTexture(gl, gl.NEAREST, null, gl.canvas.width, gl.canvas.height);
        this.screenTexture = util.createTexture(gl, gl.NEAREST, null, gl.canvas.width, gl.canvas.height);
    }

    setColorRamp(colors) {
        // lookup texture for colorizing the particles according to their speed
        this.gl.deleteTexture(this.colorRampTexture);
        this.colorRampTexture = util.createTexture(this.gl, this.gl.LINEAR, getColorRamp(colors), 16, 16);
    }

    set numParticles(numParticles) {
        const gl = this.gl;

        // a square texture where each pixel holds one particle position as two floats
        const particleRes = this.particleStateResolution = Math.ceil(Math.sqrt(numParticles));
        this._numParticles = particleRes * particleRes;

        const particleState = new Float32Array(this._numParticles * 2);
        for (let i = 0; i < particleState.length; i++) {
            particleState[i] = Math.random(); // randomize the initial particle positions
        }
        gl.deleteTexture(this.particleStateTexture0);
        gl.deleteTexture(this.particleStateTexture1);
        // textures to hold the particle state for the current and the next frame
        this.particleStateTexture0 = util.createFloatTexture(gl, particleState, particleRes, particleRes);
        this.particleStateTexture1 = util.createFloatTexture(gl, null, particleRes, particleRes);
    }
    get numParticles() {
        return this._numParticles;
    }

    setWind(windData) {
        this.windData = windData;
        this.gl.deleteTexture(this.windTexture);
        this.windTexture = util.createTexture(this.gl, this.gl.LINEAR, windData.image);
    }

    // releases every GL resource; the instance is unusable afterwards
    destroy() {
        const gl = this.gl;
        for (const program of [this.drawProgram, this.screenProgram, this.updateProgram]) {
            gl.deleteProgram(program.program);
        }
        for (const texture of [this.backgroundTexture, this.screenTexture, this.colorRampTexture,
            this.windTexture, this.particleStateTexture0, this.particleStateTexture1]) {
            gl.deleteTexture(texture);
        }
        gl.deleteVertexArray(this.quadVAO);
        gl.deleteVertexArray(this.particleVAO);
        gl.deleteBuffer(this.quadBuffer);
        gl.deleteFramebuffer(this.framebuffer);
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

        gl.bindVertexArray(this.quadVAO);
        util.bindTexture(gl, texture, 2);
        gl.uniform1i(program.u_screen, 2);
        gl.uniform1f(program.u_opacity, opacity);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    drawParticles() {
        const gl = this.gl;
        const program = this.drawProgram;
        gl.useProgram(program.program);

        gl.bindVertexArray(this.particleVAO);
        util.bindTexture(gl, this.colorRampTexture, 2);

        gl.uniform1i(program.u_wind, 0);
        gl.uniform1i(program.u_particles, 1);
        gl.uniform1i(program.u_color_ramp, 2);

        gl.uniform1i(program.u_particles_res, this.particleStateResolution);
        gl.uniform2f(program.u_wind_min, this.windData.uMin, this.windData.vMin);
        gl.uniform2f(program.u_wind_max, this.windData.uMax, this.windData.vMax);

        gl.drawArrays(gl.POINTS, 0, this._numParticles);
    }

    updateParticles() {
        const gl = this.gl;
        util.bindFramebuffer(gl, this.framebuffer, this.particleStateTexture1);
        gl.viewport(0, 0, this.particleStateResolution, this.particleStateResolution);

        const program = this.updateProgram;
        gl.useProgram(program.program);

        gl.bindVertexArray(this.quadVAO);

        gl.uniform1i(program.u_wind, 0);
        gl.uniform1i(program.u_particles, 1);

        gl.uniform1f(program.u_rand_seed, Math.random());
        gl.uniform2f(program.u_wind_res, this.windData.width, this.windData.height);
        gl.uniform2f(program.u_wind_min, this.windData.uMin, this.windData.vMin);
        gl.uniform2f(program.u_wind_max, this.windData.uMax, this.windData.vMax);
        gl.uniform1f(program.u_speed_factor, this.speedFactor);
        gl.uniform1f(program.u_drop_rate, this.dropRate);
        gl.uniform1f(program.u_drop_rate_bump, this.dropRateBump);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

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

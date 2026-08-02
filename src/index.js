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

        // reused for every off-screen pass, re-pointed at the target texture each time
        this.framebuffer = gl.createFramebuffer();

        this.setColorRamp(defaultRampColors);
        this.resize();
    }

    resize() {
        const gl = this.gl;
        gl.deleteTexture(this.backgroundTexture);
        gl.deleteTexture(this.screenTexture);
        // the previous and the current frame, swapped each draw to fade out the trails
        this.backgroundTexture = util.createTexture(gl, gl.RGBA8, null, gl.canvas.width, gl.canvas.height);
        this.screenTexture = util.createTexture(gl, gl.RGBA8, null, gl.canvas.width, gl.canvas.height);
    }

    setColorRamp(colors) {
        // lookup texture for colorizing the particles according to their speed
        this.gl.deleteTexture(this.colorRampTexture);
        this.colorRampTexture = util.createTexture(this.gl, this.gl.RGBA8, getColorRamp(colors), 256, 1);
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
        // particle state for the current and the next frame; the next one is only ever
        // rendered into, so it just needs storage
        this.particleStateTexture0 = util.createTexture(gl, gl.RG32F, particleState, particleRes, particleRes);
        this.particleStateTexture1 = util.createTexture(gl, gl.RG32F, null, particleRes, particleRes);
    }
    get numParticles() {
        return this._numParticles;
    }

    setWind(windData) {
        const gl = this.gl;
        this.windData = windData;
        gl.deleteTexture(this.windTexture);
        this.windTexture = util.createTexture(gl, gl.RGBA8, windData.image);

        // wrap in S to interpolate across the date line
        gl.bindTexture(gl.TEXTURE_2D, this.windTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    // releases every GL resource; the instance is unusable afterwards
    destroy() {
        const gl = this.gl;
        for (const program of [this.drawProgram, this.screenProgram, this.updateProgram]) {
            gl.deleteProgram(program);
        }
        for (const texture of [this.backgroundTexture, this.screenTexture, this.colorRampTexture,
            this.windTexture, this.particleStateTexture0, this.particleStateTexture1]) {
            gl.deleteTexture(texture);
        }
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
        // draw into a texture so this frame can serve as the next frame's background
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.screenTexture, 0);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        this.drawTexture(this.backgroundTexture, this.fadeOpacity);
        this.drawParticles();

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
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
        gl.useProgram(program);

        util.bindTexture(gl, texture, 2);
        gl.uniform1i(program.u_screen, 2);
        gl.uniform1f(program.u_opacity, opacity);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    drawParticles() {
        const gl = this.gl;
        const program = this.drawProgram;
        gl.useProgram(program);

        util.bindTexture(gl, this.colorRampTexture, 2);

        gl.uniform1i(program.u_wind, 0);
        gl.uniform1i(program.u_particles, 1);
        gl.uniform1i(program.u_color_ramp, 2);

        gl.uniform1i(program.u_particles_res, this.particleStateResolution);
        gl.uniform2f(program.u_wind_res, this.windData.width, this.windData.height);
        gl.uniform2f(program.u_wind_min, this.windData.uMin, this.windData.vMin);
        gl.uniform2f(program.u_wind_max, this.windData.uMax, this.windData.vMax);

        gl.drawArrays(gl.POINTS, 0, this._numParticles);
    }

    updateParticles() {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.particleStateTexture1, 0);
        gl.viewport(0, 0, this.particleStateResolution, this.particleStateResolution);

        const program = this.updateProgram;
        gl.useProgram(program);

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

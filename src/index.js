
import * as util from './util';

import drawVert from './shaders/draw.vert.glsl';
import drawFrag from './shaders/draw.frag.glsl';

import quadVert from './shaders/quad.vert.glsl';

import screenFrag from './shaders/screen.frag.glsl';
import updateFrag from './shaders/update.frag.glsl';

var defaultRampColors = {
    0.0: '#3288bd',
    0.1: '#66c2a5',
    0.2: '#abdda4',
    0.3: '#e6f598',
    0.4: '#fee08b',
    0.5: '#fdae61',
    0.6: '#f46d43',
    1.0: '#d53e4f'
};

export class WindGL {
    constructor(gl) {
        this.gl = gl;

        this.drawProgram = util.createProgram(gl, drawVert, drawFrag);
        this.screenProgram = util.createProgram(gl, quadVert, screenFrag);
        this.updateProgram = util.createProgram(gl, quadVert, updateFrag);

        var emptyPixels = new Uint8Array(gl.canvas.width * gl.canvas.height * 4);
        this.backgroundTexture = util.createTexture(gl, gl.NEAREST, emptyPixels, gl.canvas.width, gl.canvas.height);
        this.screenTexture = util.createTexture(gl, gl.NEAREST, emptyPixels, gl.canvas.width, gl.canvas.height);

        var colorRamp = getColorRamp(defaultRampColors);
        this.colorRampTexture = util.createTexture(gl, gl.LINEAR, colorRamp, 16, 16);

        this.quadBuffer = util.createBuffer(gl, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]));

        this.framebuffer = gl.createFramebuffer();
    }

    setParticles(numParticles) {
        var gl = this.gl;

        var particleRes = this.particleStateResolution = Math.ceil(Math.sqrt(numParticles));
        this.numParticles = particleRes * particleRes;

        var particleState = new Uint8Array(this.numParticles * 4);
        for (var i = 0; i < particleState.length; i++) {
            particleState[i] = Math.floor(Math.random() * 256);
        }
        this.particleStateTexture0 = util.createTexture(gl, gl.NEAREST, particleState, particleRes, particleRes);
        this.particleStateTexture1 = util.createTexture(gl, gl.NEAREST, particleState, particleRes, particleRes);

        var particleIndices = new Float32Array(this.numParticles);
        for (i = 0; i < this.numParticles; i++) particleIndices[i] = i;
        this.particleIndexBuffer = util.createBuffer(gl, particleIndices);
    }

    setWind(windData, windImage) {
        this.windData = windData;
        this.windTexture = util.createTexture(this.gl, this.gl.LINEAR, windImage);
    }

    draw() {
        var gl = this.gl;
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.STENCIL_TEST);

        util.bindTexture(gl, this.windTexture, 0);
        util.bindTexture(gl, this.particleStateTexture0, 1);

        util.bindFramebuffer(gl, this.framebuffer, this.screenTexture);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        this.drawTexture(this.backgroundTexture, 0.999);
        this.drawParticles();

        util.bindFramebuffer(gl, null);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        this.drawTexture(this.screenTexture, 1.0);
        gl.disable(gl.BLEND);

        util.bindFramebuffer(gl, this.framebuffer, this.particleStateTexture1);
        gl.viewport(0, 0, this.particleStateResolution, this.particleStateResolution);
        this.updateParticles();

        var temp = this.backgroundTexture;
        this.backgroundTexture = this.screenTexture;
        this.screenTexture = temp;

        temp = this.particleStateTexture0;
        this.particleStateTexture0 = this.particleStateTexture1;
        this.particleStateTexture1 = temp;
    }

    drawTexture(texture, opacity) {
        var gl = this.gl;
        var program = this.screenProgram;
        gl.useProgram(program.program);

        util.bindAttribute(gl, this.quadBuffer, program.a_pos, 2);
        util.bindTexture(gl, texture, 2);
        gl.uniform1i(program.u_screen, 2);
        gl.uniform1f(program.u_opacity, opacity);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    drawParticles() {
        var gl = this.gl;
        var program = this.drawProgram;
        gl.useProgram(program.program);

        util.bindAttribute(gl, this.particleIndexBuffer, program.a_index, 1);
        util.bindTexture(gl, this.colorRampTexture, 2);

        gl.uniform1i(program.u_wind, 0);
        gl.uniform1i(program.u_particles, 1);
        gl.uniform1i(program.u_color_ramp, 2);

        gl.uniform1f(program.u_particles_res, this.particleStateResolution);
        gl.uniform2f(program.u_wind_min, this.windData.uMin, this.windData.vMin);
        gl.uniform2f(program.u_wind_max, this.windData.uMax, this.windData.vMax);

        gl.drawArrays(gl.POINTS, 0, this.numParticles);
    }

    updateParticles() {
        var gl = this.gl;
        var program = this.updateProgram;
        gl.useProgram(program.program);

        util.bindAttribute(gl, this.quadBuffer, program.a_pos, 2);

        gl.uniform1i(program.u_wind, 0);
        gl.uniform1i(program.u_particles, 1);

        gl.uniform1f(program.u_rand_seed, Math.random());
        gl.uniform2f(program.u_wind_res, this.windData.width, this.windData.height);
        gl.uniform2f(program.u_wind_min, this.windData.uMin, this.windData.vMin);
        gl.uniform2f(program.u_wind_max, this.windData.uMax, this.windData.vMax);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
}

function getColorRamp(colors) {
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');

    canvas.width = 256;
    canvas.height = 1;

    var gradient = ctx.createLinearGradient(0, 0, 256, 0);
    for (var stop in colors) {
        gradient.addColorStop(+stop, colors[stop]);
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 1);

    return new Uint8Array(ctx.getImageData(0, 0, 256, 1).data);
}

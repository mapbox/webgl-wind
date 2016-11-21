
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

export function init(gl, windData, windImage, particleStateResolution) {
    var drawProgram = util.createProgram(gl, drawVert, drawFrag);
    var screenProgram = util.createProgram(gl, quadVert, screenFrag);
    var updateProgram = util.createProgram(gl, quadVert, updateFrag);

    var numParticles = particleStateResolution * particleStateResolution;
    var particleState = new Uint8Array(numParticles * 4);
    for (var i = 0; i < particleState.length; i++) {
        particleState[i] = Math.floor(Math.random() * 256);
    }

    var windTexture = util.createTexture(gl, gl.LINEAR, windImage);

    var particleStateTexture0 = util.createTexture(gl, gl.NEAREST, particleState, particleStateResolution, particleStateResolution);
    var particleStateTexture1 = util.createTexture(gl, gl.NEAREST, particleState, particleStateResolution, particleStateResolution);

    var emptyPixels = new Uint8Array(gl.canvas.width * gl.canvas.height * 4);
    var backgroundTexture = util.createTexture(gl, gl.NEAREST, emptyPixels, gl.canvas.width, gl.canvas.height);
    var screenTexture = util.createTexture(gl, gl.NEAREST, emptyPixels, gl.canvas.width, gl.canvas.height);

    var colorRamp = getColorRamp(defaultRampColors);
    var colorRampTexture = util.createTexture(gl, gl.LINEAR, colorRamp, 16, 16);

    var quadBuffer = util.createBuffer(gl, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]));

    var particleIndices = new Float32Array(numParticles);
    for (i = 0; i < numParticles; i++) particleIndices[i] = i;
    var particleIndexBuffer = util.createBuffer(gl, particleIndices);

    var framebuffer = gl.createFramebuffer();

    function draw() {
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.STENCIL_TEST);

        util.bindTexture(gl, windTexture, 0);
        util.bindTexture(gl, particleStateTexture0, 1);

        util.bindFramebuffer(gl, framebuffer, screenTexture);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        drawTexture(backgroundTexture, 0.999);
        drawParticles();

        util.bindFramebuffer(gl, null);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        drawTexture(screenTexture, 1.0);
        gl.disable(gl.BLEND);

        util.bindFramebuffer(gl, framebuffer, particleStateTexture1);
        gl.viewport(0, 0, particleStateResolution, particleStateResolution);
        updateParticles();

        var temp = backgroundTexture;
        backgroundTexture = screenTexture;
        screenTexture = temp;

        temp = particleStateTexture0;
        particleStateTexture0 = particleStateTexture1;
        particleStateTexture1 = temp;
    }

    function drawTexture(texture, opacity) {
        gl.useProgram(screenProgram.program);

        util.bindAttribute(gl, quadBuffer, updateProgram.a_pos, 2);

        util.bindTexture(gl, texture, 2);
        gl.uniform1i(screenProgram.u_screen, 2);

        gl.uniform1f(screenProgram.u_opacity, opacity);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    function drawParticles() {
        gl.useProgram(drawProgram.program);

        util.bindAttribute(gl, particleIndexBuffer, drawProgram.a_index, 1);

        util.bindTexture(gl, colorRampTexture, 2);

        gl.uniform1i(drawProgram.u_wind, 0);
        gl.uniform1i(drawProgram.u_particles, 1);
        gl.uniform1i(drawProgram.u_color_ramp, 2);

        gl.uniform1f(drawProgram.u_particles_res, particleStateResolution);
        gl.uniform2f(drawProgram.u_wind_min, windData.uMin, windData.vMin);
        gl.uniform2f(drawProgram.u_wind_max, windData.uMax, windData.vMax);

        gl.drawArrays(gl.POINTS, 0, numParticles);
    }

    function updateParticles() {
        gl.useProgram(updateProgram.program);

        util.bindAttribute(gl, quadBuffer, updateProgram.a_pos, 2);

        gl.uniform1i(updateProgram.u_wind, 0);
        gl.uniform1i(updateProgram.u_particles, 1);

        gl.uniform1f(updateProgram.u_rand_seed, Math.random());
        gl.uniform2f(updateProgram.u_wind_res, windData.width, windData.height);
        gl.uniform2f(updateProgram.u_wind_min, windData.uMin, windData.vMin);
        gl.uniform2f(updateProgram.u_wind_max, windData.uMax, windData.vMax);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    return draw;
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

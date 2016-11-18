'use strict';

var util = require('./util');
var fs = require('fs');

var updateVert = fs.readFileSync(require.resolve('./shaders/update.vert.glsl'), 'utf8');
var updateFrag = fs.readFileSync(require.resolve('./shaders/update.frag.glsl'), 'utf8');

var drawVert = fs.readFileSync(require.resolve('./shaders/draw.vert.glsl'), 'utf8');
var drawFrag = fs.readFileSync(require.resolve('./shaders/draw.frag.glsl'), 'utf8');

var blendVert = fs.readFileSync(require.resolve('./shaders/blend.vert.glsl'), 'utf8');
var blendFrag = fs.readFileSync(require.resolve('./shaders/blend.frag.glsl'), 'utf8');

var screenVert = fs.readFileSync(require.resolve('./shaders/screen.vert.glsl'), 'utf8');
var screenFrag = fs.readFileSync(require.resolve('./shaders/screen.frag.glsl'), 'utf8');

module.exports = init;

var defaultRampColors = {
    0.0: '#3288bd',
    0.1: '#66c2a5',
    0.2: '#abdda4',
    0.3: '#e6f598',
    0.4: '#fee08b',
    0.6: '#fdae61',
    0.8: '#f46d43',
    1.0: '#d53e4f'
};

function init(gl, windData, windImage, particleStateTextureSize) {
    var updateProgram = util.createProgram(gl, updateVert, updateFrag);
    var drawProgram = util.createProgram(gl, drawVert, drawFrag);
    var screenProgram = util.createProgram(gl, screenVert, screenFrag);
    var blendProgram = util.createProgram(gl, blendVert, blendFrag);

    var numParticles = particleStateTextureSize * particleStateTextureSize;
    var particleState = new Uint8Array(numParticles * 4);
    for (var i = 0; i < particleState.length; i++) {
        particleState[i] = Math.floor(Math.random() * 256);
    }

    var windTexture = util.createTexture(gl, gl.LINEAR, gl.REPEAT, windImage);

    var particleStateTexture0 = util.createTexture(gl, gl.NEAREST, gl.CLAMP_TO_EDGE, particleState, particleStateTextureSize, particleStateTextureSize);
    var particleStateTexture1 = util.createTexture(gl, gl.NEAREST, gl.CLAMP_TO_EDGE, particleState, particleStateTextureSize, particleStateTextureSize);

    var blackPixels = new Uint8Array(gl.canvas.width * gl.canvas.height * 4);
    for (i = 0; i < blackPixels.length; i += 4) {
        blackPixels[i + 3] = 255;
    }
    var backgroundTexture = util.createTexture(gl, gl.NEAREST, gl.CLAMP_TO_EDGE, blackPixels, gl.canvas.width, gl.canvas.height);
    var particlesTexture = util.createTexture(gl, gl.NEAREST, gl.CLAMP_TO_EDGE, blackPixels, gl.canvas.width, gl.canvas.height);
    var screenTexture = util.createTexture(gl, gl.NEAREST, gl.CLAMP_TO_EDGE, blackPixels, gl.canvas.width, gl.canvas.height);

    var colorRamp = getColorRamp(defaultRampColors);
    var colorRampTexture = util.createTexture(gl, gl.LINEAR, gl.CLAMP_TO_EDGE, colorRamp, 16, 16);

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

        util.bindFramebuffer(gl, framebuffer, particlesTexture);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        drawParticles();

        util.bindFramebuffer(gl, framebuffer, screenTexture);
        addTrails();

        util.bindFramebuffer(gl, null);
        drawScreen();

        var temp = backgroundTexture;
        backgroundTexture = screenTexture;
        screenTexture = temp;

        util.bindFramebuffer(gl, framebuffer, particleStateTexture1);
        gl.viewport(0, 0, particleStateTextureSize, particleStateTextureSize);
        updateParticles();

        temp = particleStateTexture0;
        particleStateTexture0 = particleStateTexture1;
        particleStateTexture1 = temp;
    }

    function drawParticles() {
        gl.useProgram(drawProgram.program);

        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        util.bindAttribute(gl, particleIndexBuffer, drawProgram.a_index, 1);

        util.bindTexture(gl, colorRampTexture, 2);

        gl.uniform1i(drawProgram.u_wind, 0);
        gl.uniform1i(drawProgram.u_particles, 1);
        gl.uniform1i(drawProgram.u_color_ramp, 2);

        gl.uniform1f(drawProgram.u_particles_tex_size, particleStateTextureSize);
        gl.uniform1f(drawProgram.u_wind_tex_size, windData.size);
        gl.uniform2f(drawProgram.u_wind_tex_scale, windData.width, windData.height);
        gl.uniform2f(drawProgram.u_wind_min, windData.uMin, windData.vMin);
        gl.uniform2f(drawProgram.u_wind_max, windData.uMax, windData.vMax);

        gl.drawArrays(gl.POINTS, 0, numParticles);
    }

    function addTrails() {
        gl.useProgram(blendProgram.program);

        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        util.bindAttribute(gl, quadBuffer, updateProgram.a_position, 2);

        util.bindTexture(gl, backgroundTexture, 2);
        util.bindTexture(gl, particlesTexture, 3);

        gl.uniform1i(blendProgram.u_background, 2);
        gl.uniform1i(blendProgram.u_foreground, 3);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    function drawScreen() {
        gl.useProgram(screenProgram.program);

        util.bindAttribute(gl, quadBuffer, updateProgram.a_position, 2);
        util.bindTexture(gl, screenTexture, 2);
        gl.uniform1i(screenProgram.u_screen, 2);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    function updateParticles() {
        gl.useProgram(updateProgram.program);

        util.bindAttribute(gl, quadBuffer, updateProgram.a_position, 2);

        gl.uniform1i(updateProgram.u_wind, 0);
        gl.uniform1i(updateProgram.u_particles, 1);

        gl.uniform1f(updateProgram.u_wind_tex_size, windData.size);
        gl.uniform2f(updateProgram.u_wind_tex_scale, windData.width, windData.height);
        gl.uniform1f(updateProgram.u_rand_seed, Math.random());
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

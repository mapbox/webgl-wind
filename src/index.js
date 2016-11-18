'use strict';

var util = require('./util');
var fs = require('fs');

var updateVert = fs.readFileSync(require.resolve('./shaders/update.vert.glsl'), 'utf8');
var updateFrag = fs.readFileSync(require.resolve('./shaders/update.frag.glsl'), 'utf8');

var drawVert = fs.readFileSync(require.resolve('./shaders/draw.vert.glsl'), 'utf8');
var drawFrag = fs.readFileSync(require.resolve('./shaders/draw.frag.glsl'), 'utf8');

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

function init(gl, windData, windImage, particleTextureSize) {
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.STENCIL_TEST);

    var updateProgram = util.createProgram(gl, updateVert, updateFrag);
    var drawProgram = util.createProgram(gl, drawVert, drawFrag);

    var numParticles = particleTextureSize * particleTextureSize;
    var particleData = new Uint8Array(numParticles * 4);
    for (var i = 0; i < particleData.length; i++) {
        particleData[i] = Math.floor(Math.random() * 256);
    }

    var windTexture = util.createTexture(gl, gl.LINEAR, gl.REPEAT, windImage);

    var particleTexture0 = util.createTexture(gl, gl.NEAREST, gl.CLAMP_TO_EDGE, particleData, particleTextureSize);
    var particleTexture1 = util.createTexture(gl, gl.NEAREST, gl.CLAMP_TO_EDGE, particleData, particleTextureSize);

    var colorRamp = getColorRamp(defaultRampColors);
    var colorRampTexture = util.createTexture(gl, gl.LINEAR, gl.CLAMP_TO_EDGE, colorRamp, 16);

    var quadBuffer = util.createBuffer(gl, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]));

    var particleIndices = new Float32Array(numParticles);
    for (i = 0; i < numParticles; i++) particleIndices[i] = i;
    var particleIndexBuffer = util.createBuffer(gl, particleIndices);

    var framebuffer = gl.createFramebuffer();

    util.bindTexture(gl, windTexture, 0);
    util.bindTexture(gl, colorRampTexture, 1);

    function drawParticles() {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(drawProgram.program);

        util.bindAttribute(gl, particleIndexBuffer, drawProgram.a_index, 1);

        util.bindTexture(gl, particleTexture0, 2);

        gl.uniform1i(drawProgram.u_wind, 0);
        gl.uniform1i(drawProgram.u_color_ramp, 1);
        gl.uniform1i(drawProgram.u_particles, 2);

        gl.uniform1f(drawProgram.u_particles_tex_size, particleTextureSize);
        gl.uniform1f(drawProgram.u_wind_tex_size, windData.size);
        gl.uniform2f(drawProgram.u_wind_tex_scale, windData.width, windData.height);
        gl.uniform2f(drawProgram.u_wind_min, windData.uMin, windData.vMin);
        gl.uniform2f(drawProgram.u_wind_max, windData.uMax, windData.vMax);

        gl.drawArrays(gl.POINTS, 0, numParticles);
    }

    function updateParticles() {
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, particleTexture1, 0);

        gl.viewport(0, 0, particleTextureSize, particleTextureSize);

        gl.useProgram(updateProgram.program);

        util.bindAttribute(gl, quadBuffer, updateProgram.a_position, 2);

        util.bindTexture(gl, particleTexture0, 2);

        gl.uniform1i(updateProgram.u_wind, 0);
        gl.uniform1i(updateProgram.u_particles, 2);

        gl.uniform1f(updateProgram.u_wind_tex_size, windData.size);
        gl.uniform2f(updateProgram.u_wind_tex_scale, windData.width, windData.height);
        gl.uniform1f(updateProgram.u_rand_seed, Math.random());
        gl.uniform2f(updateProgram.u_wind_min, windData.uMin, windData.vMin);
        gl.uniform2f(updateProgram.u_wind_max, windData.uMax, windData.vMax);

        gl.drawArrays(gl.TRIANGLES, 0, 6);

        var tempTexture = particleTexture0;
        particleTexture0 = particleTexture1;
        particleTexture1 = tempTexture;
    }

    return function draw() {
        drawParticles();
        updateParticles();
    };
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

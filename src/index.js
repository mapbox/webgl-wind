'use strict';

var util = require('./util');
var windData = require('./wind_texture');
var fs = require('fs');

var updateVert = fs.readFileSync(require.resolve('./shaders/update.vert.glsl'), 'utf8');
var updateFrag = fs.readFileSync(require.resolve('./shaders/update.frag.glsl'), 'utf8');

var drawVert = fs.readFileSync(require.resolve('./shaders/draw.vert.glsl'), 'utf8');
var drawFrag = fs.readFileSync(require.resolve('./shaders/draw.frag.glsl'), 'utf8');

module.exports = init;

var particleTextureSize = 512;
var numParticles = particleTextureSize * particleTextureSize;

function init(gl) {
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.STENCIL_TEST);

    var windTexture = util.createTexture(gl, windData.size, gl.LINEAR, windData.data);

    var particleData = new Uint8Array(numParticles * 4);
    for (var i = 0; i < particleData.length; i++) {
        particleData[i] = Math.floor(Math.random() * 256);
    }
    var particleTexture0 = util.createTexture(gl, particleTextureSize, gl.NEAREST, particleData);
    var particleTexture1 = util.createTexture(gl, particleTextureSize, gl.NEAREST, particleData);

    var quadBuffer = util.createBuffer(gl, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]));
    var updateProgram = util.createProgram(gl, updateVert, updateFrag);
    var framebuffer = gl.createFramebuffer();

    var particleIndices = new Float32Array(numParticles);
    for (i = 0; i < numParticles; i++) particleIndices[i] = i;
    var particleIndexBuffer = util.createBuffer(gl, particleIndices);
    var drawProgram = util.createProgram(gl, drawVert, drawFrag);

    function drawParticles() {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, particleTexture0);

        gl.useProgram(drawProgram.program);

        util.bindAttribute(gl, particleIndexBuffer, drawProgram.a_index, 1);

        gl.uniform1f(drawProgram.u_particles_tex_size, particleTextureSize);

        gl.drawArrays(gl.POINTS, 0, numParticles);
    }

    function updateParticles() {
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, particleTexture1, 0);

        gl.useProgram(updateProgram.program);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, particleTexture0);
        gl.uniform1i(updateProgram.u_particles, 0);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, windTexture);
        gl.uniform1i(updateProgram.u_wind, 1);

        gl.viewport(0, 0, particleTextureSize, particleTextureSize);

        util.bindAttribute(gl, quadBuffer, updateProgram.a_position, 2);

        gl.uniform1f(updateProgram.u_wind_tex_size, windData.size);
        gl.uniform2f(updateProgram.u_wind_tex_scale, windData.width, windData.height);
        gl.uniform1f(updateProgram.u_rand_seed, Math.random());

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

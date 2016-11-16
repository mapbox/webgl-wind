'use strict';

var initScene = require('../src');

var canvas = document.getElementById('canvas');

function resizeCanvas() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
}
resizeCanvas();

var gl = canvas.getContext('webgl');

var drawScene = initScene(gl);

function frame() {
    drawScene();
    requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

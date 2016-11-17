'use strict';

var initScene = require('../src');

var canvas = document.getElementById('canvas');

canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;

var gl = canvas.getContext('webgl');

var windData = require('./wind.json');

var windImage = new Image();
windImage.src = 'wind.png';

windImage.onload = function () {

    var drawScene = initScene(gl, windData, windImage);

    requestAnimationFrame(function frame() {
        drawScene();
        requestAnimationFrame(frame);
    });
};


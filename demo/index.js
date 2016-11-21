import {init} from '../src/index';

var canvas = document.getElementById('canvas');

canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;

var gl = canvas.getContext('webgl');

import windData from './wind.json';

var windImage = new Image();
windImage.src = 'wind.png';

windImage.onload = function () {

    var draw = init(gl, windData, windImage, 256);

    requestAnimationFrame(function frame() {
        draw();
        requestAnimationFrame(frame);
    });
};


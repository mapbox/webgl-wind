import {WindGL} from '../src/index';

var canvas = document.getElementById('canvas');

canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;

var gl = canvas.getContext('webgl');

var wind = window.wind = new WindGL(gl);
wind.setParticles(65536);

function frame() {
    if (wind.windData) {
        wind.draw();
    }
    requestAnimationFrame(frame);
}
frame();

updateWind('wind');

function updateWind(name) {
    getJSON(name + '.json', function (windData) {
        var windImage = new Image();
        windImage.src = name + '.png';
        windImage.onload = function () {
            wind.setWind(windData, windImage);
        };
    });
}

window.updateWind = updateWind;

function getJSON(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.responseType = 'json';
    xhr.open('get', url, true);
    xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) {
            callback(xhr.response);
        } else {
            throw new Error(xhr.statusText);
        }
    };
    xhr.send();
}

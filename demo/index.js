import {WindGL} from '../src/index';

var canvas = document.getElementById('canvas');

canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;

var gl = canvas.getContext('webgl');

var wind = window.wind = new WindGL(gl);
wind.numParticles = 65536;

function frame() {
    if (wind.windData) {
        wind.draw();
    }
    requestAnimationFrame(frame);
}
frame();

var gui = new dat.GUI();
gui.add(wind, 'numParticles', 1024, 262144);
gui.add(wind, 'fadeOpacity', 0.96, 0.999).step(0.001).updateDisplay();
gui.add(wind, 'speedFactor', 0.05, 1.0);
gui.add(wind, 'dropRate', 0, 0.1);
gui.add(wind, 'dropRateBump', 0, 0.2);

getJSON('https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_110m_coastline.geojson', function (data) {
    var canvas = document.getElementById('coastline');
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    var ctx = canvas.getContext('2d');
    ctx.lineWidth = 2;
    ctx.lineJoin = ctx.lineCap = 'round';
    ctx.strokeStyle = 'white';
    ctx.beginPath();

    for (var i = 0; i < data.features.length; i++) {
        var line = data.features[i].geometry.coordinates;
        for (var j = 0; j < line.length; j++) {
            var x = (line[j][0] + 180) * canvas.width / 360;
            var y = (-line[j][1] + 90) * canvas.height / 180;
            if (j === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
    }
    ctx.stroke();
});

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

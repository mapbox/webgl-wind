import {GUI} from 'https://cdn.jsdelivr.net/npm/lil-gui@0.21.0/dist/lil-gui.esm.js';

import WindGL from '../src/index.js';

// wind data files, one per 6 hours, written by data/prepare.js
const windFiles = await fetch('wind/index.json').then(res => res.json());

// the slider is an hour offset from the first frame, e.g. "2026-07-31T12Z+h"
const [, year, month, day, hour] = windFiles[0].match(/(\d{4})(\d\d)(\d\d)(\d\d)/);
const sliderLabel = `${year}-${month}-${day}T${hour}Z+h`;

const meta = {
    hours: 0,
    'retina resolution': true,
    'github.com/mapbox/webgl-wind'() {
        window.location = 'https://github.com/mapbox/webgl-wind';
    }
};

const canvas = document.getElementById('canvas');
const pxRatio = Math.max(Math.floor(window.devicePixelRatio) || 1, 2);
resizeCanvas();

const gl = canvas.getContext('webgl', {antialiasing: false});

const wind = window.wind = new WindGL(gl);
wind.numParticles = 65536;

function frame() {
    if (wind.windData) {
        wind.draw();
    }
    requestAnimationFrame(frame);
}
frame();

const gui = new GUI();
gui.add(wind, 'numParticles', 1024, 589824);
gui.add(wind, 'fadeOpacity', 0.96, 0.999).step(0.001).updateDisplay();
gui.add(wind, 'speedFactor', 0.05, 1.0);
gui.add(wind, 'dropRate', 0, 0.1);
gui.add(wind, 'dropRateBump', 0, 0.2);
gui.add(meta, 'hours', 0, (windFiles.length - 1) * 6, 6).name(sliderLabel).onFinishChange(updateWind);
gui.add(meta, 'retina resolution').onFinishChange(updateRetina);
gui.add(meta, 'github.com/mapbox/webgl-wind');

updateWind(0);

function resizeCanvas() {
    const ratio = meta['retina resolution'] ? pxRatio : 1;
    canvas.width = canvas.clientWidth * ratio;
    canvas.height = canvas.clientHeight * ratio;
}

function updateRetina() {
    resizeCanvas();
    wind.resize();
}

async function updateWind(hours) {
    const name = windFiles[hours / 6];
    const [windData, image] = await Promise.all([
        fetch(`wind/${name}.json`).then(res => res.json()),
        fetch(`wind/${name}.png`).then(res => res.blob()).then(createImageBitmap)
    ]);
    wind.setWind({...windData, image});
}

const coastline = await fetch('https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_110m_coastline.geojson').then(res => res.json());

const coastCanvas = document.getElementById('coastline');
coastCanvas.width = coastCanvas.clientWidth * pxRatio;
coastCanvas.height = coastCanvas.clientHeight * pxRatio;

const ctx = coastCanvas.getContext('2d');
ctx.lineWidth = pxRatio;
ctx.lineJoin = ctx.lineCap = 'round';
ctx.strokeStyle = 'white';
ctx.beginPath();

for (const {geometry} of coastline.features) {
    for (const [i, [lng, lat]] of geometry.coordinates.entries()) {
        ctx[i ? 'lineTo' : 'moveTo'](
            (lng + 180) * coastCanvas.width / 360,
            (-lat + 90) * coastCanvas.height / 180);
    }
}
ctx.stroke();

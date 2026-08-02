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
const coastCanvas = document.getElementById('coastline');

// declared up here because the resize observer below can run before it's loaded
let coastline;

const gl = canvas.getContext('webgl', {antialias: false});

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
gui.add(meta, 'retina resolution').onFinishChange(resize);
gui.add(meta, 'github.com/mapbox/webgl-wind');

updateWind(0);

// read afresh each time — it changes when the window moves between displays or the
// page is zoomed
const pixelRatio = () => (meta['retina resolution'] ? window.devicePixelRatio : 1);

// both canvases are 100vw/100vh, so one observer covers them; it also fires once on
// setup, which is what does the initial sizing. Setting canvas.width doesn't affect
// the CSS box, so this can't loop.
new ResizeObserver(resize).observe(canvas);

function resize() {
    const ratio = pixelRatio();
    canvas.width = canvas.clientWidth * ratio;
    canvas.height = canvas.clientHeight * ratio;
    wind.resize();

    coastCanvas.width = coastCanvas.clientWidth * ratio;
    coastCanvas.height = coastCanvas.clientHeight * ratio;
    drawCoastline();
}

async function updateWind(hours) {
    const name = windFiles[hours / 6];
    const [windData, image] = await Promise.all([
        fetch(`wind/${name}.json`).then(res => res.json()),
        fetch(`wind/${name}.png`).then(res => res.blob()).then(createImageBitmap)
    ]);
    wind.setWind({...windData, image});
}

fetch('https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_110m_coastline.geojson')
    .then(res => res.json())
    .then((data) => {
        coastline = data;
        drawCoastline();
    });

function drawCoastline() {
    if (!coastline) return; // still loading — resize() or the fetch will call us again

    const ctx = coastCanvas.getContext('2d');
    ctx.lineWidth = pixelRatio();
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
}

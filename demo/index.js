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

const gl = canvas.getContext('webgl2', {antialias: false});

const wind = window.wind = new WindGL(gl);
wind.numParticles = 65536;

function frame(now) {
    if (wind.windTexture) {
        wind.draw(now);
    }
    requestAnimationFrame(frame);
}
frame();

const gui = new GUI();
gui.add(wind, 'numParticles', 1024, 589824);
gui.add(wind, 'trailDuration', 0.2, 30);
gui.add(wind, 'speed', 0.25, 10);
gui.add(wind, 'rampMaxSpeed', 5, 40);
gui.add(wind, 'particleLife', 0.5, 10);
gui.add(wind, 'particleTravel', 20, 300);
gui.add(meta, 'hours', 0, (windFiles.length - 1) * 6, 6).name(sliderLabel).onFinishChange(updateWind);
gui.add(meta, 'retina resolution').onFinishChange(resize);
gui.add(meta, 'github.com/mapbox/webgl-wind');

updateWind(0);

// read afresh each time: it changes with the display and with page zoom
const pixelRatio = () => (meta['retina resolution'] ? window.devicePixelRatio : 1);

// both canvases are 100vw/100vh, so one observer covers them; its initial fire does the
// initial sizing. Setting canvas.width doesn't affect the CSS box, so this can't loop.
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
    const blob = await fetch(`wind/${windFiles[hours / 6]}.png`).then(res => res.blob());
    // the PNG holds numbers, not colours: no conversion may touch the channels
    wind.setWind(await createImageBitmap(blob, {colorSpaceConversion: 'none', premultiplyAlpha: 'none'}));
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

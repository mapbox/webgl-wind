import {GUI} from 'https://cdn.jsdelivr.net/npm/lil-gui@0.21.0/dist/lil-gui.esm.js';

import WindGL from '../src/index.js';

// wind data files, one per 6 hours starting from 2016-11-20T00:00Z
const windFiles = [
    '2016112000', '2016112006', '2016112012', '2016112018', '2016112100',
    '2016112106', '2016112112', '2016112118', '2016112200'
];

const meta = {
    '2016-11-20+h': 0,
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
gui.add(meta, '2016-11-20+h', 0, 48, 6).onFinishChange(updateWind);
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

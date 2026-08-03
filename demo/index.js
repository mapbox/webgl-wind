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

// the Mercator rect both the wind and the coastline are drawn against, set by resize()
let view;

const gl = canvas.getContext('webgl2', {antialias: false});

const wind = window.wind = new WindGL(gl);

function frame(now) {
    if (wind.windTexture) {
        wind.draw(now);
    }
    requestAnimationFrame(frame);
}
frame();

const gui = new GUI();
gui.add(wind, 'particleSpacing', 3, 20);
// derived from the spacing and the CSS size, so read-only — but worth watching
gui.add(wind, 'numParticles').disable().listen();
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

// both canvases are 100vw/100vh, so one observer covers them; setting canvas.width doesn't
// affect the CSS box, so this can't loop. Called directly as well because the observer's first
// fire is async, and a view is needed before the first frame or the coastline arrives.
new ResizeObserver(resize).observe(canvas);
resize();

function resize() {
    const ratio = pixelRatio();
    canvas.width = canvas.clientWidth * ratio;
    canvas.height = canvas.clientHeight * ratio;
    wind.resize();

    // the full Mercator Y range, so the poles are always in frame; a wide window then shows more
    // than one world across, which the unwrapped X handles — the lookup wraps and so does the
    // coastline below, while the particles never see a world copy at all
    const [width, height] = [canvas.clientWidth, canvas.clientHeight];
    const spanX = width / height;
    view = [0.5 - spanX / 2, 0, 0.5 + spanX / 2, 1];
    wind.setView(view);

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

// clamped a little short of the poles, where Mercator runs off to infinity: Antarctica's
// coastline reaches -90, and the projected edge would be a line the canvas can't draw
const mercatorY = lat => 0.5 - Math.log(Math.tan(Math.PI / 4 + Math.max(-85, Math.min(85, lat)) * Math.PI / 360)) / (2 * Math.PI);

function drawCoastline() {
    if (!coastline) return; // still loading — resize() or the fetch will call us again

    const ctx = coastCanvas.getContext('2d');
    ctx.lineWidth = pixelRatio();
    ctx.lineJoin = ctx.lineCap = 'round';
    ctx.strokeStyle = 'white';
    ctx.beginPath();

    const [minX, minY, maxX, maxY] = view;

    // once per world copy the view overlaps: one normally, more once the rect is wider than a
    // world or straddles the antimeridian, which an unwrapped minX can do arbitrarily far out
    for (let copy = Math.floor(minX); copy <= Math.floor(maxX); copy++) {
        for (const {geometry} of coastline.features) {
            for (const [i, [lng, lat]] of geometry.coordinates.entries()) {
                ctx[i ? 'lineTo' : 'moveTo'](
                    (copy + (lng + 180) / 360 - minX) / (maxX - minX) * coastCanvas.width,
                    (mercatorY(lat) - minY) / (maxY - minY) * coastCanvas.height);
            }
        }
    }
    ctx.stroke();
}

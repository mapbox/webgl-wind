import {GUI} from 'https://cdn.jsdelivr.net/npm/lil-gui@0.21.0/dist/lil-gui.esm.js';

import WindGL from '../src/index.js';

// wind frames, one per 6 hours, written by data/prepare.js: a name and the ±m/s it's encoded against
const windFiles = await fetch('wind/index.json').then(res => res.json());

// the slider is an hour offset from the first frame, e.g. "2026-07-31T12Z+h"
const [, year, month, day, hour] = windFiles[0].name.match(/(\d{4})(\d\d)(\d\d)(\d\d)/);
const sliderLabel = `${year}-${month}-${day}T${hour}Z+h`;

const meta = {
    hours: 0,
    // the zoomed-out anchor of the speed law below, in CSS px/s per m/s — the whole curve
    // slides with it, since the other anchor is real time and can't move
    speed: 2.2,
    'time lapse': '',
    'retina resolution': true,
    'github.com/mapbox/webgl-wind'() {
        window.location = 'https://github.com/mapbox/webgl-wind';
    }
};

const canvas = document.getElementById('canvas');
const coastCanvas = document.getElementById('coastline');

// declared up here because the resize observer below can run before it's loaded
let coastline;

// the Mercator rect both the wind and the coastline are drawn against, derived by updateView()
let view;

// the camera: a Mercator center and the world spans the canvas width, so a zoom is one number
// instead of four correlated ones. X stays unwrapped, so dragging west past the antimeridian is
// continuous — nothing here or downstream cares which world copy the center sits in.
const camera = {x: 0.5, y: 0.5, scale: 1};

const EARTH_CIRCUMFERENCE = 40075017; // m at the equator, which is the Mercator plane's full width

// the zoom-in limit, as a resolution rather than a scale so it doesn't depend on the window size.
// Not tied to the wind grid's own resolution: past it the field is genuinely uniform, but that's
// still the honest answer for a local view, and it's the one a drone operator is asking for.
const MIN_METERS_PER_PIXEL = 0.1;

// zooming out further would need world above the pole, which Mercator hasn't got
const clampScale = scale => Math.min(
    Math.max(scale, canvas.clientHeight / canvas.clientWidth),
    EARTH_CIRCUMFERENCE / (canvas.clientWidth * MIN_METERS_PER_PIXEL));

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
gui.add(meta, 'speed', 0.25, 10).onChange(updateView);
// how much faster than reality the field is moving; 1 once the zoom is close enough
gui.add(meta, 'time lapse').disable().listen();
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

    coastCanvas.width = coastCanvas.clientWidth * ratio;
    coastCanvas.height = coastCanvas.clientHeight * ratio;

    // the aspect is baked into the rect, so a resize has to redo it before the next frame
    updateView();
}

function updateView() {
    const [width, height] = [canvas.clientWidth, canvas.clientHeight];
    camera.scale = clampScale(camera.scale);

    const spanX = 1 / camera.scale;
    const spanY = spanX * height / width;
    // Y is held in range by moving the center, never by trimming the rect: a trimmed rect wouldn't
    // match the canvas aspect, and the simulation steps in pixels, so speed would gain a direction
    camera.y = Math.min(Math.max(camera.y, spanY / 2), 1 - spanY / 2);

    view = [camera.x - spanX / 2, camera.y - spanY / 2, camera.x + spanX / 2, camera.y + spanY / 2];

    // A fixed px/s per m/s is a time-lapse whose factor falls as you zoom in — the ground is
    // magnified but the particles aren't, so a feature that took a second to cross takes minutes.
    // Real time is the honest alternative but is invisible zoomed out: 20 m/s is 0.0005 px/s over
    // a whole world. So anchor one at each end — meta.speed at the world view, real time at the
    // zoom limit — and interpolate geometrically in log zoom. That's a single smooth power law
    // instead of max() of the two, whose knee fell inside the last decade of zoom and read as a
    // jolt. The shader's own 1/cos(lat) turns these Mercator metres into ground metres.
    const realTime = width / (EARTH_CIRCUMFERENCE * spanX);
    const t = Math.log(camera.scale) / Math.log(EARTH_CIRCUMFERENCE / (width * MIN_METERS_PER_PIXEL));
    wind.speed = meta.speed * (1 / (MIN_METERS_PER_PIXEL * meta.speed)) ** t;
    meta['time lapse'] = `${Math.round(wind.speed / realTime)}×`;

    wind.setView(view);
    drawCoastline();
}

// capture so a drag that wanders off the canvas keeps tracking and ends with the button, and
// so the pointer that started the drag is the only one that moves the view
canvas.addEventListener('pointerdown', e => canvas.setPointerCapture(e.pointerId));

canvas.addEventListener('pointermove', (e) => {
    if (!canvas.hasPointerCapture(e.pointerId)) return;
    // the drag moves the ground with the cursor, so the camera moves the other way
    camera.x -= e.movementX / canvas.clientWidth * (view[2] - view[0]);
    camera.y -= e.movementY / canvas.clientHeight * (view[3] - view[1]);
    updateView();
});

canvas.addEventListener('wheel', (e) => {
    e.preventDefault(); // otherwise the page scrolls, or a trackpad pinch zooms the browser
    // deltaY comes in lines or pages as well as pixels, so normalize roughly; only smoothness suffers
    const factor = Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.002));

    const [width, height] = [canvas.clientWidth, canvas.clientHeight];
    // the Mercator point under the cursor, which the zoom has to leave where it is
    const anchorX = view[0] + e.offsetX / width * (view[2] - view[0]);
    const anchorY = view[1] + e.offsetY / height * (view[3] - view[1]);

    // clamped here rather than in updateView(), because the new span is what places the center
    camera.scale = clampScale(camera.scale * factor);
    const spanX = 1 / camera.scale;
    camera.x = anchorX - (e.offsetX / width - 0.5) * spanX;
    camera.y = anchorY - (e.offsetY / height - 0.5) * spanX * height / width;
    updateView();
}, {passive: false});

async function updateWind(hours) {
    const {name, range} = windFiles[hours / 6];
    const blob = await fetch(`wind/${name}.png`).then(res => res.blob());
    // the PNG holds numbers, not colours: no conversion may touch the channels
    const image = await createImageBitmap(blob, {colorSpaceConversion: 'none', premultiplyAlpha: 'none'});
    wind.setWind(image, range);
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
    // redrawn on every pan frame, not just on resize, so the previous strokes have to go
    ctx.clearRect(0, 0, coastCanvas.width, coastCanvas.height);
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

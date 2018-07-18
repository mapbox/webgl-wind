// using var to work around a WebKit bug
var canvas = document.getElementById('canvas'); // eslint-disable-line

const pxRatio = Math.max(Math.floor(window.devicePixelRatio) || 1, 2);
canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;

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

const gui = new dat.GUI();
gui.add(wind, 'numParticles', 1024, 589824);
gui.add(wind, 'fadeOpacity', 0.96, 0.999, 0.001).updateDisplay();
gui.add(wind, 'speedFactor', 0.05, 1.0);
gui.add(wind, 'dropRate', 0, 0.1);
gui.add(wind, 'dropRateBump', 0, 0.2);

const windFiles = {
    0: '2016112000',
    6: '2016112006',
    12: '2016112012',
    18: '2016112018',
    24: '2016112100',
    30: '2016112106',
    36: '2016112112',
    42: '2016112118',
    48: '2016112200'
};

const meta = {
    'zoom': 0,
    '2016-11-20+h': 0,
    'retina resolution': true,
    'github.com/mapbox/webgl-wind': function () {
        window.location = 'https://github.com/mapbox/webgl-wind';
    }
};

gui.add(meta, 'zoom', 0, 8, 0.01).onChange(updateZoom);
gui.add(meta, '2016-11-20+h', 0, 48, 6).onFinishChange(updateWind);

if (pxRatio !== 1) {
    gui.add(meta, 'retina resolution').onFinishChange(updateRetina);
}

gui.add(meta, 'github.com/mapbox/webgl-wind');

updateWind(0);
updateRetina();

function updateZoom() {
    const halfSize = 0.5 / Math.pow(2, meta.zoom);
    wind.setView([
        0.5 - halfSize,
        0.5 - halfSize,
        0.5 + halfSize,
        0.5 + halfSize
    ]);
    drawCoastline();
    wind.resize();
    wind.numParticles = wind.numParticles;
}

function updateRetina() {
    const ratio = meta['retina resolution'] ? pxRatio : 1;
    canvas.width = canvas.clientWidth * ratio;
    canvas.height = canvas.clientHeight * ratio;
    wind.resize();
}

let coastlineFeatures;

getJSON('https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_110m_coastline.geojson', function (data) {
    coastlineFeatures = data.features;
    drawCoastline();
});

function drawCoastline() {
    const canvas = document.getElementById('coastline');
    canvas.width = canvas.clientWidth * pxRatio;
    canvas.height = canvas.clientHeight * pxRatio;

    const ctx = canvas.getContext('2d');
    ctx.lineWidth = pxRatio;
    ctx.lineJoin = ctx.lineCap = 'round';
    ctx.strokeStyle = 'white';
    ctx.beginPath();

    for (let i = 0; i < coastlineFeatures.length; i++) {
        const line = coastlineFeatures[i].geometry.coordinates;
        for (let j = 0; j < line.length; j++) {
            const x = (line[j][0] + 180) / 360;
            const y = latY(line[j][1]);
            const minX = wind.bbox[0];
            const minY = latY(90 - 180 * wind.bbox[1]);
            const maxX = wind.bbox[2];
            const maxY = latY(90 - 180 * wind.bbox[3]);
            ctx[j ? 'lineTo' : 'moveTo'](
                (x - minX) / (maxX - minX) * canvas.width,
                (y - (1 - maxY)) / (maxY - minY) * canvas.height);
        }
    }
    ctx.stroke();
}

function updateWind(name) {
    getJSON('wind/' + windFiles[name] + '.json', function (windData) {
        const windImage = new Image();
        windData.image = windImage;
        windImage.src = 'wind/' + windFiles[name] + '.png';
        windImage.onload = function () {
            wind.setWind(windData);
            wind.resize();
        };
    });
}

function getJSON(url, callback) {
    const xhr = new XMLHttpRequest();
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

function latY(lat) {
    const sin = Math.sin(lat * Math.PI / 180),
        y = (0.5 - 0.25 * Math.log((1 + sin) / (1 - sin)) / Math.PI);
    return y < 0 ? 0 :
           y > 1 ? 1 : y;
}

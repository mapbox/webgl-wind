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

// 移除默认的dat.GUI控制面板，使用中文数据面板

const windFiles = {
    0: '2025062701'
};

const meta = {
    'retina resolution': true
};

// 设置retina分辨率
if (pxRatio !== 1) {
    updateRetina();
}

// 初始化风场数据
updateWind(0);

// 不再使用dat.GUI控制面板，所有控制功能都在中文数据面板中

function updateRetina() {
    const ratio = meta['retina resolution'] ? pxRatio : 1;
    canvas.width = canvas.clientWidth * ratio;
    canvas.height = canvas.clientHeight * ratio;
    wind.resize();
}

getJSON('https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_110m_coastline.geojson', function (data) {
    const canvas = document.getElementById('coastline');
    canvas.width = canvas.clientWidth * pxRatio;
    canvas.height = canvas.clientHeight * pxRatio;

    const ctx = canvas.getContext('2d');
    ctx.lineWidth = pxRatio;
    ctx.lineJoin = ctx.lineCap = 'round';
    ctx.strokeStyle = 'white';
    ctx.beginPath();

    // 中国东南沿海区域边界
    const lonMin = 104, lonMax = 126;
    const latMin = 14, latMax = 31;

    for (let i = 0; i < data.features.length; i++) {
        const line = data.features[i].geometry.coordinates;
        for (let j = 0; j < line.length; j++) {
            const lon = line[j][0];
            const lat = line[j][1];
            
            // 只绘制在目标区域内的海岸线
            if (lon >= lonMin && lon <= lonMax && lat >= latMin && lat <= latMax) {
                ctx[j ? 'lineTo' : 'moveTo'](
                    (lon - lonMin) * canvas.width / (lonMax - lonMin),
                    (latMax - lat) * canvas.height / (latMax - latMin));
            }
        }
    }
    ctx.stroke();
});

function updateWind(name) {
    getJSON('/data/wind_data/wrf_data/' + windFiles[name] + '.json', function (windData) {
        if (windData) {
            const windImage = new Image();
            windData.image = windImage;
            windImage.src = '/data/wind_data/wrf_data/' + windFiles[name] + '.png';
            windImage.onload = function () {
                wind.setWind(windData);
            };
            windImage.onerror = function() {
                console.error('PNG图像加载失败:', windImage.src);
            };
        } else {
            console.error('风场数据加载失败，无法显示可视化');
        }
    });
}

function updateWindData(dataInfo) {
    // 确保路径以'/'开头以适应绝对路径
    const jsonPath = dataInfo.path.startsWith('/') ? dataInfo.path : '/' + dataInfo.path;
    const pngPath = dataInfo.path.startsWith('/') ? dataInfo.path : '/' + dataInfo.path;
    
    getJSON(jsonPath + '.json', function (windData) {
        if (windData) {
            const windImage = new Image();
            windData.image = windImage;
            windImage.src = pngPath + '.png';
            windImage.onload = function () {
                wind.setWind(windData);
                console.log('风场数据更新成功:', dataInfo.name);
            };
            windImage.onerror = function() {
                console.error('PNG图像加载失败:', windImage.src);
            };
        } else {
            console.error('风场数据加载失败，无法显示可视化');
        }
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
            console.error('加载失败:', url, '状态码:', xhr.status);
            callback(null); // 不抛出异常，而是传递null
        }
    };
    xhr.onerror = function() {
        console.error('网络请求失败:', url);
        callback(null);
    };
    xhr.send();
}

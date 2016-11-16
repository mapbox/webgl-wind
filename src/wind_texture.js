'use strict';

const GFS = require('../data/gfs.json');

const gridWidth = GFS.lo2 - GFS.lo1 + 1;
const gridHeight = GFS.la1 - GFS.la2 + 1;

const textureSize = 512; // texture must be a square with a 2^n size
const data = new Uint8Array(textureSize * textureSize * 4).fill(255);

const minWind = -30;
const maxWind = 37;

for (let y = 0; y <= gridHeight; y++) {
    for (let x = 0; x <= gridWidth; x++) {

        let k = (y % gridHeight) * gridWidth + x % gridWidth;
        const i = (y * textureSize + x) * 4;

        data[i + 0] = Math.floor(255 * (GFS.u[k] - minWind) / (maxWind - minWind));
        data[i + 1] = Math.floor(255 * (GFS.v[k] - minWind) / (maxWind - minWind));
    }
}

exports.data = data;
exports.size = textureSize;
exports.width = gridWidth;
exports.height = gridHeight;

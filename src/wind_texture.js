'use strict';

var GFS = require('../data/gfs.json');

var gridWidth = GFS.lo2 - GFS.lo1 + 1;
var gridHeight = GFS.la1 - GFS.la2 + 1;

var textureSize = 512; // texture must be a square with a 2^n size
var data = new Uint8Array(textureSize * textureSize * 4).fill(255);

var minWind = -30;
var maxWind = 37;

for (var y = 0; y <= gridHeight; y++) {
    for (var x = 0; x <= gridWidth; x++) {

        var k = (y % gridHeight) * gridWidth + x % gridWidth;
        var i = (y * textureSize + x) * 4;

        data[i + 0] = Math.floor(255 * (GFS.u[k] - minWind) / (maxWind - minWind));
        data[i + 1] = Math.floor(255 * (GFS.v[k] - minWind) / (maxWind - minWind));
    }
}

exports.data = data;
exports.size = textureSize;
exports.width = gridWidth;
exports.height = gridHeight;

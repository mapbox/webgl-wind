'use strict';

var PNG = require('pngjs').PNG;
var fs = require('fs');
var path = require('path');

var data = JSON.parse(fs.readFileSync('tmp.json'));
var name = process.argv[2];
var u = data.u;
var v = data.v;

var size = Math.pow(2, Math.ceil(Math.log2(u.Ni))); ;

var png = new PNG({
    colorType: 2,
    filterType: 4,
    width: size,
    height: size
});

for (var y = 0; y < u.Nj; y++) {
    for (var x = 0; x < u.Ni; x++) {
        var i = (size * y + x) * 4;
        var k = y * u.Ni + x;
        png.data[i + 0] = Math.floor(255 * (u.values[k] - u.minimum) / (u.maximum - u.minimum));
        png.data[i + 1] = Math.floor(255 * (v.values[k] - v.minimum) / (v.maximum - v.minimum));
        png.data[i + 2] = 0;
        png.data[i + 3] = 255;
    }
}

for (x = 0; x < size; x++) {
    for (k = 0; k < 4; k++) {
        png.data[(size * (size - 1) + x) * 4 + k] = png.data[x * 4 + k];
    }
}

for (y = 0; y < size; y++) {
    for (k = 0; k < 4; k++) {
        png.data[(size * y + size - 1) * 4 + k] = png.data[size * y * 4 + k];
    }
}

png.pack().pipe(fs.createWriteStream(name + '.png'));

fs.writeFileSync(name + '.json', JSON.stringify({
    source: "http://nomads.ncep.noaa.gov",
    date: u.dataDate,
    width: u.Ni,
    height: u.Nj - 1,
    uMin: u.minimum,
    uMax: u.maximum,
    vMin: v.minimum,
    vMax: v.maximum,
    size: size
}, null, 2) + '\n');

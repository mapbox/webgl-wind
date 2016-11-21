var PNG = require('pngjs').PNG;
var fs = require('fs');

var data = JSON.parse(fs.readFileSync('tmp.json'));
var name = process.argv[2];
var u = data.u;
var v = data.v;

var width = u.Ni;
var height = u.Nj - 1;

var png = new PNG({
    colorType: 2,
    filterType: 4,
    width: width,
    height: height
});

for (var y = 0; y < height; y++) {
    for (var x = 0; x < width; x++) {
        var i = (y * width + x) * 4;
        var k = y * width + x;
        png.data[i + 0] = Math.floor(255 * (u.values[k] - u.minimum) / (u.maximum - u.minimum));
        png.data[i + 1] = Math.floor(255 * (v.values[k] - v.minimum) / (v.maximum - v.minimum));
        png.data[i + 2] = 0;
        png.data[i + 3] = 255;
    }
}

png.pack().pipe(fs.createWriteStream(name + '.png'));

fs.writeFileSync(name + '.json', JSON.stringify({
    source: 'http://nomads.ncep.noaa.gov',
    date: formatDate(u.dataDate + '', u.dataTime),
    width: width,
    height: height,
    uMin: u.minimum,
    uMax: u.maximum,
    vMin: v.minimum,
    vMax: v.maximum
}, null, 2) + '\n');

function formatDate(date, time) {
    return date.substr(0, 4) + '-' + date.substr(4, 2) + '-' + date.substr(6, 2) + 'T' +
        (time < 10 ? '0' + time : time) + ':00Z';
}

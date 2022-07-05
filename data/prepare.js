const PNG = require('pngjs').PNG;
const fs = require('fs');

const data = JSON.parse(fs.readFileSync('tmp.json'));
const name = process.argv[2];
const u = data.u;
const v = data.v;

const udataDate=u.messages[0].find((temp)=>{return temp.key=='dataDate'}).value;
const udataTime=u.messages[0].find((temp)=>{return temp.key=='dataTime'}).value;

const uminimum=u.messages[0].find((temp)=>{return temp.key=='minimum'}).value;
const umaximum=u.messages[0].find((temp)=>{return temp.key=='maximum'}).value;

const vminimum=v.messages[0].find((temp)=>{return temp.key=='minimum'}).value;
const vmaximum=v.messages[0].find((temp)=>{return temp.key=='maximum'}).value;

const uvalues=u.messages[0].find((temp)=>{return temp.key=='values'}).value;
const vvalues=v.messages[0].find((temp)=>{return temp.key=='values'}).value;

const width = u.messages[0].find((temp)=>{return temp.key=='Ni'}).value;
const height = u.messages[0].find((temp)=>{return temp.key=='Nj'}).value-1;

const png = new PNG({
    colorType: 2,
    filterType: 4,
    width: width,
    height: height
});

for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const k = y * width + (x + width / 2) % width;
        png.data[i + 0] = Math.floor(255 * (uvalues[k] - uminimum) / (umaximum - uminimum));
        png.data[i + 1] = Math.floor(255 * (vvalues[k] - vminimum) / (vmaximum - vminimum));
        png.data[i + 2] = 0;
        png.data[i + 3] = 255;
    }
}

png.pack().pipe(fs.createWriteStream(name + '.png'));

fs.writeFileSync(name + '.json', JSON.stringify({
    source: 'http://nomads.ncep.noaa.gov',
    date: formatDate(udataDate + '', udataTime),
    width: width,
    height: height,
    uMin: uminimum,
    uMax: umaximum,
    vMin: vminimum,
    vMax: vmaximum
}, null, 2) + '\n');

function formatDate(date, time) {
    return date.substr(0, 4) + '-' + date.substr(4, 2) + '-' + date.substr(6, 2) + 'T' +
        (time < 10 ? '0' + time : time) + ':00Z';
}

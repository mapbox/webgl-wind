import {PNG} from 'pngjs';
import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync('tmp.json'));
const name = process.argv[2];
const {u, v} = data;

const width = u.Ni;
const height = u.Nj - 1;

const png = new PNG({
    colorType: 2,
    filterType: 4,
    width,
    height
});

for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const k = y * width + (x + width / 2) % width;
        png.data[i + 0] = Math.floor(255 * (u.values[k] - u.minimum) / (u.maximum - u.minimum));
        png.data[i + 1] = Math.floor(255 * (v.values[k] - v.minimum) / (v.maximum - v.minimum));
        png.data[i + 2] = 0;
        png.data[i + 3] = 255;
    }
}

fs.writeFileSync(`${name}.png`, PNG.sync.write(png));

fs.writeFileSync(`${name}.json`, `${JSON.stringify({
    source: 'http://nomads.ncep.noaa.gov',
    date: formatDate(`${u.dataDate}`, u.dataTime),
    width,
    height,
    uMin: u.minimum,
    uMax: u.maximum,
    vMin: v.minimum,
    vMax: v.maximum
}, null, 2)}\n`);

function formatDate(date, time) {
    return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${`${time}`.padStart(2, '0')}:00Z`;
}

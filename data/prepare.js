// Fetches recent 100 m wind from the NCEP GFS 0.25° model and writes one PNG per frame for
// WindGL.setWind(). Data comes from Unidata's THREDDS server over OPeNDAP's ASCII
// output, which is plain text — no GRIB tooling needed.
//
//     node data/prepare.js [outDir] [frames]
//
// Frames are 6 hours apart, ending at the most recent one available. Each PNG is a
// 1440x720 equirectangular grid, lat 90°→-90° down the rows, lon centred on 0°E, u in
// red and v in green per src/encode.js. Each frame is encoded against its own measured
// range, so index.json carries a {name, range} per frame for setWind() to read.

import {PNG} from 'pngjs';
import fs from 'node:fs';
import path from 'node:path';

import {encodeWind} from '../src/encode.js';

const DATASET = 'https://thredds.ucar.edu/thredds/dodsC/grib/NCEP/GFS/Global_0p25deg/Best';
const width = 1440;
const height = 720; // the grid has 721 rows, but the last one repeats the first
const step = 216e5; // 6 hours

// index into height_above_ground2, which runs 10, 20, 30, 40, 50, 80, 100 m — the top of it
// being where a drone actually flies, and well above the surface drag that thins 10 m wind
const level = 6;

const outDir = process.argv[2] || '.';
const frames = Number(process.argv[3]) || 1;

const get = async query => (await fetch(`${DATASET}.${query}`)).text();
const numbers = text => text.match(/-?\d+\.\d+(e[-+]\d+)?/gi).map(Number);

// the aggregation's epoch drifts as old runs age out, so read it rather than assume
const [epoch] = (await get('das')).match(/(?<=\btime \{[^}]*?Hour since )[^"]+/s);
const latest = Math.floor(Date.now() / step) * step;

const written = [];

for (let i = frames - 1; i >= 0; i--) {
    // deliberately sequential — each frame is already two parallel requests, and
    // THREDDS is someone else's public server
    // eslint-disable-next-line no-await-in-loop
    written.push(await writeFrame(new Date(latest - i * step)));
}

// so that the demo can pick up whatever was generated without hardcoding dates or ranges
fs.writeFileSync(path.join(outDir, 'index.json'), `${JSON.stringify(written)}\n`);

async function writeFrame(date) {
    // forecast times are every 3 hours from the epoch, so the index is the offset / 3h
    const index = (date - new Date(epoch)) / 108e5;

    // [time][level][all lats][all lons], lat descending 90°→-90°, lon 0°→359.75°. Around 10 MB
    // of text per component at this resolution: slow, but it keeps the fetch dependency-free.
    const [u, v] = await Promise.all(['u', 'v'].map(async (component) => {
        const name = `${component}-component_of_wind_height_above_ground`;
        const slice = `${name}[${index}][${level}][0:${height}][0:${width - 1}]`;
        const body = await get(`ascii?${encodeURIComponent(slice)}`);
        // the coordinate axes are repeated after the grid, and each row is prefixed
        // with its `[t][z][y], ` index — integers, which `numbers` skips
        return numbers(body.slice(0, body.indexOf(`${name}.time`)));
    }));

    // the range this frame is encoded against, measured rather than assumed: nothing can then
    // saturate, whatever the height or the weather, and a calm frame gets a finer step for free.
    // Rounded up so the extreme lands exactly on a code, and floored at 1 m/s for a still field.
    // (a spread would be a million arguments)
    const peak = values => values.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
    const range = Math.max(1, Math.ceil(Math.max(peak(u), peak(v))));

    const png = new PNG({colorType: 2, filterType: 4, width, height});

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            // roll by half a turn: GFS starts at 0°E, the texture is centred on it
            const k = y * width + (x + width / 2) % width;
            png.data[i + 0] = encodeWind(u[k], range);
            png.data[i + 1] = encodeWind(v[k], range);
            png.data[i + 2] = 0;
            png.data[i + 3] = 255;
        }
    }

    const hour = date.toISOString().slice(0, 13);
    const name = hour.replace(/[-T]/g, '');
    const file = path.join(outDir, name);

    fs.writeFileSync(`${file}.png`, PNG.sync.write(png));

    console.log(`wrote ${file}.png (range ±${range} m/s)`);
    return {name, range};
}

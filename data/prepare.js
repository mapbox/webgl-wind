// Fetches recent 10 m wind from the NCEP GFS 1° model and writes a PNG + JSON metadata
// pair per frame for WindGL.setWind(). Data comes from Unidata's THREDDS server over
// OPeNDAP's ASCII output, which is plain text — no GRIB tooling needed.
//
//     node data/prepare.js [outDir] [frames]
//
// Frames are 6 hours apart, ending at the most recent one available.

import {PNG} from 'pngjs';
import fs from 'node:fs';
import path from 'node:path';

const DATASET = 'https://thredds.ucar.edu/thredds/dodsC/grib/NCEP/GFS/Global_onedeg/Best';
const width = 360;
const height = 180; // the grid has 181 rows, but the last one repeats the first
const step = 216e5; // 6 hours

const outDir = process.argv[2] || '.';
const frames = Number(process.argv[3]) || 1;

const get = async query => (await fetch(`${DATASET}.${query}`)).text();
const numbers = text => text.match(/-?\d+\.\d+(e[-+]\d+)?/gi).map(Number);

// the aggregation's epoch drifts as old runs age out, so read it rather than assume
const [epoch] = (await get('das')).match(/(?<=\btime \{[^}]*?Hour since )[^"]+/s);
const latest = Math.floor(Date.now() / step) * step;

const names = [];

for (let i = frames - 1; i >= 0; i--) {
    // deliberately sequential — each frame is already two parallel requests, and
    // THREDDS is someone else's public server
    // eslint-disable-next-line no-await-in-loop
    names.push(await writeFrame(new Date(latest - i * step)));
}

// so that the demo can pick up whatever was generated without hardcoding dates
fs.writeFileSync(path.join(outDir, 'index.json'), `${JSON.stringify(names)}\n`);

async function writeFrame(date) {
    // forecast times are every 3 hours from the epoch, so the index is the offset / 3h
    const index = (date - new Date(epoch)) / 108e5;

    // [time][10 m][all lats][all lons], lat descending 90°→-90°, lon 0°→359°
    const [u, v] = await Promise.all(['u', 'v'].map(async (component) => {
        const name = `${component}-component_of_wind_height_above_ground`;
        const body = await get(`ascii?${encodeURIComponent(`${name}[${index}][0][0:180][0:359]`)}`);
        // the coordinate axes are repeated after the grid, and each row is prefixed
        // with its `[t][z][y], ` index — integers, which `numbers` skips
        const values = numbers(body.slice(0, body.indexOf(`${name}.time`)));
        // 65k values is too many to spread into Math.min
        let min = Infinity, max = -Infinity;
        for (const value of values) {
            min = Math.min(min, value);
            max = Math.max(max, value);
        }
        return {values, min, max};
    }));

    const png = new PNG({colorType: 2, filterType: 4, width, height});

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            // roll by half a turn: GFS starts at 0°E, the texture is centred on it
            const k = y * width + (x + width / 2) % width;
            png.data[i + 0] = Math.floor(255 * (u.values[k] - u.min) / (u.max - u.min));
            png.data[i + 1] = Math.floor(255 * (v.values[k] - v.min) / (v.max - v.min));
            png.data[i + 2] = 0;
            png.data[i + 3] = 255;
        }
    }

    const hour = date.toISOString().slice(0, 13);
    const name = hour.replace(/[-T]/g, '');
    const file = path.join(outDir, name);

    fs.writeFileSync(`${file}.png`, PNG.sync.write(png));
    fs.writeFileSync(`${file}.json`, `${JSON.stringify({
        source: DATASET,
        date: `${hour}:00Z`,
        width,
        height,
        uMin: u.min,
        uMax: u.max,
        vMin: v.min,
        vMax: v.max
    }, null, 2)}\n`);

    console.log(`wrote ${file}.png`);
    return name;
}

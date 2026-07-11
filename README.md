## WebGL Wind — [Demo](https://mapbox.github.io/webgl-wind/demo/)

A WebGL-powered visualization of wind power.
Capable of rendering up to 1 million wind particles at 60fps.

This project is heavily inspired by the work of:

- [Cameron Beccario](https://twitter.com/cambecc)
and his wonderful [Earth project](https://earth.nullschool.net/)
with its [open-source version](https://github.com/cambecc/earth).
- [Fernanda Viégas and Martin Wattenberg](http://hint.fm/) and their
[US Wind Map project](http://hint.fm/projects/wind/).
- [Chris Wellons](http://nullprogram.com) and his WebGL tutorials,
in particular [A GPU Approach to Particle Physics](http://nullprogram.com/blog/2014/06/29/).
- [Greggman](http://games.greggman.com/game/) and his [WebGL Fundamentals](http://webglfundamentals.org/) guide.

### Running the demo locally

```bash
npm install
npm run build
npm start
# open http://127.0.0.1:1337/demo/
```

### Downloading weather data

1. Install [ecCodes](https://confluence.ecmwf.int//display/ECC/ecCodes+Home) (e.g. `brew install eccodes`).
2. Edit constants in `data/download.sh` for desired date, time and resolution.
3. Run `./data/download.sh demo/wind 20210627 00` to generate wind data files (`png` and `json`) for use with the library.
4. Modify the `windFiles`, object in demo/index.js to reference the new dataset
    1. Object keys are offsets in hours from the first date/time
    2. The label for the GUI control is in the `meta` object
    3. The min, max, and interval for the GUI control are on the `gui.add(meta, ...)` line

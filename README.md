## WebGL Wind

A WebGL-powered visualization of wind power.
Capable of rendering up to 1 million wind-led particles at 60fps.

This project is heavily inspired by the work of
[Cameron Beccario](https://twitter.com/cambecc)
with his wonderful [Earth project](https://earth.nullschool.net/)
and its [open-source version](https://github.com/cambecc/earth),
and [Fernanda Viégas and Martin Wattenberg](http://hint.fm/) with their
[US Wind Map project](http://hint.fm/projects/wind/).

### Running locally

```bash
npm install
npm run build
open demo/index.html
```

### Downloading weather data

1. Install [GRIB-API](https://software.ecmwf.int/wiki/display/GRIB/Releases).
2. Edit constants in `data/download.sh` for desired date and resolution.
3. Run `./data/download.sh <path>` to generate wind data (`<path>.png` and `<path>.json`) for use with the library.
4. Optionally run `optipng -o7 <path>.png` to reduce the wind texture file size.

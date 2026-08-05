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
npm start
# open http://127.0.0.1:3000/demo/
```

### Downloading weather data

```bash
node data/prepare.js wind 9
```

This writes one `png` per frame for use with `setWind`, taking 100 m wind
from the [NCEP GFS](https://www.ncei.noaa.gov/products/weather-climate-models/global-forecast)
0.25° model. Frames are 6 hours apart, ending at the most recent one available; the second
argument is how many to fetch (default 1).

It also writes an `index.json` listing the frames as `{name, range}`, which is what the demo
reads — point the script at `demo/wind` to refresh the demo with current weather. `range` is
the ±m/s the frame is encoded against, measured per frame rather than fixed, and `setWind`
needs it alongside the image.

Data comes from [Unidata's THREDDS server](https://thredds.ucar.edu/) over OPeNDAP's
ASCII output — plain text, so no GRIB tooling is needed. Its aggregation only reaches
back about a month.

## WebGL Wind

A WebGL-powered visualization of wind power.
Capable of rendering up to 1 million wind-led particles at 60fps.

This project is heavily inspired by the work of:

- [Cameron Beccario](https://twitter.com/cambecc)
and his wonderful [Earth project](https://earth.nullschool.net/)
with its [open-source version](https://github.com/cambecc/earth)
- [Fernanda Viégas and Martin Wattenberg](http://hint.fm/) and their
[US Wind Map project](http://hint.fm/projects/wind/)
- [Chris Wellons](http://nullprogram.com) and his WebGL tutorials,
in particular [A GPU Approach to Particle Physics](http://nullprogram.com/blog/2014/06/29/).
- [Greggman](http://games.greggman.com/game/) and his [WebGL Fundamentals](http://webglfundamentals.org/) guide.

### Running the demo locally

```bash
npm install
npm run build
npm start
# open http://127.0.0.1:1337
```

### Downloading weather data

1. Install [GRIB-API](https://software.ecmwf.int/wiki/display/GRIB/Releases).
2. Edit constants in `data/download.sh` for desired date and resolution.
3. Run `./data/download.sh <path>` to generate wind data (`<path>.png` and `<path>.json`) for use with the library.
4. Optionally run `optipng -o7 <path>.png` to reduce the wind texture file size.

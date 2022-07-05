修改了data文件夹内shell脚本及处理数据用的prepare.js文件，使脚本可正常运行



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

1. Install [ecCodes](https://confluence.ecmwf.int//display/ECC/ecCodes+Home) (e.g. `brew install eccodes`)(如果是ubuntu可以运行命令：`apt install libeccodes-tools`).
2. Edit constants in `data/download.sh` for desired date, time and resolution.
3. Run `./data/download.sh <dir>` to generate wind data files (`png` and `json`) for use with the library.

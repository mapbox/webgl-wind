const regl = createREGL();

const windGridWidth = WIND_GFS.lo2 - WIND_GFS.lo1 + 1;
const windGridHeight = WIND_GFS.la1 - WIND_GFS.la2 + 1;

const windTextureSize = 512;
const windData = new Uint8Array(windTextureSize * windTextureSize * 4).fill(255);

const minWind = -30;
const maxWind = 37;

for (let y = 0; y <= windGridHeight; y++) {
    for (let x = 0; x <= windGridWidth; x++) {

        let k = (y % windGridHeight) * windGridWidth + x % windGridWidth;
        const i = (y * windTextureSize + x) * 4;

        windData[i + 0] = Math.floor(255 * (WIND_GFS.u[k] - minWind) / (maxWind - minWind));
        windData[i + 1] = Math.floor(255 * (WIND_GFS.v[k] - minWind) / (maxWind - minWind));
    }
}

const windFramebuffer = regl.framebuffer({
    color: regl.texture({
        radius: windTextureSize,
        data: windData,
        mag: 'linear'
    }),
    depthStencil: false
});

const drawWind = regl({
    frag: `
    precision mediump float;

    uniform sampler2D wind;
    uniform float wind_tex_size;

    varying vec2 uv;

    vec2 lookup_wind(const vec2 pos) {
        // manual bilinear filtering for smoothness
        float px = 1.0 / wind_tex_size;
        vec2 vc = (floor(pos * wind_tex_size)) * px;
        vec2 f = fract(pos * wind_tex_size);
        vec2 tl = texture2D(wind, vc).rg;
        vec2 tr = texture2D(wind, vc + vec2(px, 0)).rg;
        vec2 bl = texture2D(wind, vc + vec2(0, px)).rg;
        vec2 br = texture2D(wind, vc + vec2(px, px)).rg;
        return mix(mix(tl, tr, f.x), mix(bl, br, f.x), f.y);
    }

    void main() {
        gl_FragColor = vec4(lookup_wind(uv), 1, 1);
        // gl_FragColor = texture2D(wind, uv); // hardware filtering
    }`,

    vert: `
    precision mediump float;

    attribute vec2 position;

    uniform vec2 wind_tex_scale;
    uniform float wind_tex_size;

    varying vec2 uv;

    void main() {
        uv = position * wind_tex_scale / wind_tex_size;
        gl_Position = vec4(1.0 - 2.0 * position, 0, 1);
    }`,

    attributes: {
        position: [-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]
    },
    uniforms: {
        wind: windFramebuffer,
        wind_tex_size: windTextureSize,
        wind_tex_scale: [windGridWidth, windGridHeight]
    },
    depth: {enable: false},
    count: 6
});

regl.frame(() => drawWind());

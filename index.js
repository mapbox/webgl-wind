const regl = createREGL({
    attributes: {preserveDrawingBuffer: true}
});

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

const particleTextureSize = 128;
const numParticles = particleTextureSize * particleTextureSize;
const particleData = new Uint8Array(numParticles * 4);

for (let i = 0; i < particleData.length; i++) {
    particleData[i] = Math.floor(Math.random() * 256);
}

const particleFramebuffers = Array(2).fill().map(() => regl.framebuffer({
    color: regl.texture({
        radius: particleTextureSize,
        data: particleData
    }),
    depthStencil: false
}));

const updateParticles = regl({
    frag: `
    precision mediump float;

    uniform sampler2D wind;
    uniform sampler2D particles;
    uniform vec2 wind_tex_scale;
    uniform float wind_tex_size;

    varying vec2 pos;

    vec2 encode(const float value) {
        float v = value * 255.0 * 255.0;
        return vec2(mod(v, 255.0), floor(v / 255.0)) / 255.0;
    }
    float decode(const vec2 channels) {
        return dot(channels, vec2(255.0, 255.0 * 255.0)) / (255.0 * 255.0);
    }

    vec2 lookup_wind(vec2 uv) {
        // manual bilinear filtering below for smoothness
        float px = 1.0 / wind_tex_size;
        vec2 vc = (floor(uv * wind_tex_scale)) * px;
        vec2 f = fract(uv * wind_tex_scale);
        vec2 tl = texture2D(wind, vc).rg;
        vec2 tr = texture2D(wind, vc + vec2(px, 0)).rg;
        vec2 bl = texture2D(wind, vc + vec2(0, px)).rg;
        vec2 br = texture2D(wind, vc + vec2(px, px)).rg;
        // return texture2D(wind, uv * wind_tex_scale / wind_tex_size).rg; // hardware filtering
        return mix(mix(tl, tr, f.x), mix(bl, br, f.x), f.y);
    }
    void main() {
        vec4 particle_sample = texture2D(particles, pos);
        vec2 particle_pos = vec2(decode(particle_sample.rg), decode(particle_sample.ba));

        vec2 speed = (lookup_wind(particle_pos) * 67.0) - 30.0;
        particle_pos = mod(1.0 + particle_pos + speed * 0.00002, 1.0);

        gl_FragColor = vec4(encode(particle_pos.x), encode(particle_pos.y));
    }
    `,

    vert: `
    precision mediump float;

    attribute vec2 position;
    varying vec2 pos;

    void main() {
        pos = position;
        gl_Position = vec4(1.0 - 2.0 * position, 0, 1);
    }
    `,

    attributes: {
        position: [0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]
    },
    uniforms: {
        wind: windFramebuffer,
        wind_tex_size: windTextureSize,
        wind_tex_scale: [windGridWidth, windGridHeight],
        particles: (ctx) => particleFramebuffers[ctx.tick % 2]
    },
    depth: {enable: false},
    count: 6,
    framebuffer: (ctx) => particleFramebuffers[(ctx.tick + 1) % 2]
});

const drawParticles = regl({
    frag: `
    precision highp float;

    void main() {
        gl_FragColor = vec4(1, 1, 1, 1);
    }`,

    vert: `
    precision mediump float;

    attribute float index;
    uniform sampler2D particles;
    uniform float particles_tex_size;

    float decode(const vec2 channels) {
        return dot(channels, vec2(255.0, 255.0 * 255.0)) / (255.0 * 255.0);
    }

    void main() {
        float x = mod(index, particles_tex_size);
        float y = floor(index / particles_tex_size);
        vec4 particle_sample = texture2D(particles, vec2(x, y) / particles_tex_size);
        vec2 pos = vec2(decode(particle_sample.rg), decode(particle_sample.ba));

        gl_PointSize = 1.0;
        gl_Position = vec4(1.0 - 2.0 * pos, 0, 1);
    }`,

    attributes: {
        index: new Array(numParticles).fill(0).map((_, i) => i)
    },
    uniforms: {
        particles: (ctx) => particleFramebuffers[ctx.tick % 2],
        particles_tex_size: particleTextureSize
    },
    depth: {enable: false},
    primitive: 'points',
    count: numParticles
});

regl.clear({color: [0, 0, 0, 1]});

var tick = regl.frame(() => {
    // regl.clear({color: [0, 0, 0, 1]});
    drawParticles();
    updateParticles();
});

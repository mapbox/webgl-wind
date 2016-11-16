'use strict';

const fs = require('fs');
const windTexture = require('./wind_texture');

const regl = createREGL({
    attributes: {preserveDrawingBuffer: true}
});

const windFramebuffer = regl.framebuffer({
    color: regl.texture({
        radius: windTexture.size,
        data: windTexture.data,
        mag: 'linear'
    }),
    depthStencil: false
});

const particleTextureSize = 256;
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
    frag: fs.readFileSync(require.resolve('./shaders/update.frag.glsl'), 'utf8'),
    vert: fs.readFileSync(require.resolve('./shaders/update.vert.glsl'), 'utf8'),

    attributes: {
        position: [0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]
    },
    uniforms: {
        wind: windFramebuffer,
        wind_tex_size: windTexture.size,
        wind_tex_scale: [windTexture.width, windTexture.height],
        particles: (ctx) => particleFramebuffers[ctx.tick % 2]
    },
    depth: {enable: false},
    count: 6,
    framebuffer: (ctx) => particleFramebuffers[(ctx.tick + 1) % 2]
});

const drawParticles = regl({
    frag: fs.readFileSync(require.resolve('./shaders/draw.frag.glsl'), 'utf8'),
    vert: fs.readFileSync(require.resolve('./shaders/draw.vert.glsl'), 'utf8'),

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

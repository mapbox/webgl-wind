import * as util from './util.js';
import {drawVert, drawFrag, quadVert, screenFrag, updateFrag} from './shaders.js';
import {WIND_RANGE, windStep} from './encode.js';
import {validateView, viewSpan, viewMin} from './view.js';

const defaultRampColors = {
    0.0: '#3288bd',
    0.1: '#66c2a5',
    0.2: '#abdda4',
    0.3: '#e6f598',
    0.4: '#fee08b',
    0.5: '#fdae61',
    0.6: '#f46d43',
    1.0: '#d53e4f'
};

export default class WindGL {
    // `windRange` is the ±m/s range the wind images were encoded against; constructor-only
    // so a later change can't reinterpret an already loaded image. `maxParticles` is an
    // allocation guard rather than a density control: canvas area is unbounded, so the
    // count needs some ceiling, and going over it widens the spacing with a warning.
    constructor(gl, {windRange = WIND_RANGE, maxParticles = 1e6} = {}) {
        this.gl = gl;
        this.windStep = windStep(windRange);
        this.maxParticles = maxParticles;

        // needed to render into the RGBA32F particle state textures
        if (!gl.getExtension('EXT_color_buffer_float')) {
            throw new Error('WebGL2 EXT_color_buffer_float is required');
        }

        // on by default, and it would stack an implementation-defined dither on top of ours
        gl.disable(gl.DITHER);

        this.lastFrame = 0; // timestamp of the previous draw, for the frame interval

        this.trailDuration = 12; // s — time for a trail to fade to invisible
        this.speed = 2.2; // CSS px/s of screen travel per m/s of wind, at the equator
        this.rampMaxSpeed = 32; // m/s — wind speed at the top of the color ramp
        // recycling: particles move to a random place at these two mean rates, which can
        // each be Infinity to disable that half
        this.particleLife = 2.8; // s — mean lifetime of a becalmed particle
        this.particleTravel = 115; // CSS px — mean distance travelled before recycling

        this.particleRes = 0; // state texture size; no state allocated yet

        // the latest view, and the one the state and trails are encoded against
        this.view = null;
        this.prevView = null;

        this.drawProgram = util.createProgram(gl, drawVert, drawFrag);
        this.screenProgram = util.createProgram(gl, quadVert, screenFrag);
        this.updateProgram = util.createProgram(gl, quadVert, updateFrag);

        // reused for every off-screen pass, re-pointed at the target texture each time
        this.framebuffer = gl.createFramebuffer();

        this.setColorRamp(defaultRampColors);
        this.particleSpacing = 5; // CSS px — allocates the particle state
        this.resize();
    }

    // call after the canvas drawing buffer changes size
    resize() {
        const gl = this.gl;
        gl.deleteTexture(this.backgroundTexture);
        gl.deleteTexture(this.screenTexture);
        // the previous and the current frame, swapped each draw to fade out the trails
        this.backgroundTexture = util.createTexture(gl, gl.RGBA8, null, gl.canvas.width, gl.canvas.height);
        this.screenTexture = util.createTexture(gl, gl.RGBA8, null, gl.canvas.width, gl.canvas.height);
        // the particle count follows the CSS size, so a device pixel ratio change doesn't
        // touch it — and an ordinary resize usually stays inside the same state texture
        this.initParticles();
    }

    // CSS pixels are the device-independent measure of what a human actually sees; an
    // OffscreenCanvas has no CSS box, so there its buffer size is the best answer available
    get cssSize() {
        const canvas = this.gl.canvas;
        return [canvas.clientWidth || canvas.width, canvas.clientHeight || canvas.height];
    }

    // `[minX, minY, maxX, maxY]` in Mercator units: the area the canvas shows, aspect-matched to it. X may be
    // unwrapped, so an antimeridian pan stays continuous rather than jumping a world. Required before draw().
    setView(rect) {
        validateView(rect, ...this.cssSize);
        this.view = rect;
        // nothing is rendered yet, so the first view is what the state already means;
        // afterwards prevView only advances at the end of draw()
        this.prevView ??= rect;
    }

    // the square root of screen area per particle, so it's linear in perceived gappiness —
    // nominal, since the mean nearest-neighbour distance of a uniform scattering is about half
    set particleSpacing(spacing) {
        // a floor rather than a slider bound: below it the segments merge into a wash
        this._particleSpacing = Math.max(3, spacing);
        this.initParticles();
    }
    get particleSpacing() {
        return this._particleSpacing;
    }

    setColorRamp(colors) {
        // lookup texture for colorizing the particles according to their speed
        this.gl.deleteTexture(this.colorRampTexture);
        this.colorRampTexture = util.createTexture(this.gl, this.gl.RGBA8, getColorRamp(colors), 256, 1);
    }

    // exactly how many particles the current spacing and CSS size work out to
    get numParticles() {
        return this._numParticles;
    }

    initParticles() {
        const gl = this.gl;
        const [width, height] = this.cssSize;

        const maxRes = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        const max = Math.min(this.maxParticles, maxRes * maxRes);
        const wanted = Math.round(width * height / this._particleSpacing ** 2);

        // a huge canvas or a tiny spacing thins the field out instead of failing: a coarser
        // picture beats none. Warned once per transition rather than on every resize tick.
        this._numParticles = Math.min(wanted, max);
        if (wanted > max) {
            if (!this._capped) {
                console.warn(`webgl-wind: particleSpacing ${this._particleSpacing} would need ${wanted} particles ` +
                    `at ${width}x${height} CSS px; capped at ${max}, an effective spacing of ` +
                    `${Math.sqrt(width * height / max).toFixed(1)}`);
            }
            this._capped = true;
        } else {
            this._capped = false;
        }

        // nothing to fill, so keep the state: a canvas hidden and shown again resumes
        if (!this._numParticles) return;

        // a square texture, one texel per particle, so the last row is partly padding
        const res = Math.ceil(Math.sqrt(this._numParticles));

        // padding texels are simulated like the rest, so within one resolution only the draw
        // prefix changes: their state is already current and reseeding would clear the field
        if (res === this.particleRes) return;
        this.particleRes = res;

        const particleState = new Float32Array(res * res * 4);
        for (let i = 0; i < particleState.length; i += 4) {
            // random initial positions; a zero step means no segment to draw yet
            particleState[i] = Math.random();
            particleState[i + 1] = Math.random();
        }
        gl.deleteTexture(this.particleStateTexture0);
        gl.deleteTexture(this.particleStateTexture1);
        // current and next frame; the next one is only rendered into, so it needs no data
        this.particleStateTexture0 = util.createTexture(gl, gl.RGBA32F, particleState, res, res);
        this.particleStateTexture1 = util.createTexture(gl, gl.RGBA32F, null, res, res);
    }

    // `image` is an equirectangular u/v grid encoded per src/encode.js. Decode it with
    // `createImageBitmap(blob, {colorSpaceConversion: 'none', premultiplyAlpha: 'none'})`:
    // browser defaults are entitled to rewrite the channels.
    setWind(image) {
        const gl = this.gl;
        this.windRes = [image.width, image.height];
        gl.deleteTexture(this.windTexture);
        // wraps in S to interpolate across the date line
        this.windTexture = util.createTexture(gl, gl.RGBA8, image, image.width, image.height, gl.REPEAT);
    }

    // releases every GL resource; the instance is unusable afterwards
    destroy() {
        const gl = this.gl;
        for (const program of [this.drawProgram, this.screenProgram, this.updateProgram]) {
            gl.deleteProgram(program);
        }
        for (const texture of [this.backgroundTexture, this.screenTexture, this.colorRampTexture,
            this.windTexture, this.particleStateTexture0, this.particleStateTexture1]) {
            gl.deleteTexture(texture);
        }
        gl.deleteFramebuffer(this.framebuffer);
    }

    // `now` is a timestamp in ms, as passed to a requestAnimationFrame callback
    draw(now = performance.now()) {
        const gl = this.gl;
        // a hidden or not yet laid out canvas has no area to fill; resize() picks it up later
        if (!this._numParticles) return;
        if (!this.view) throw new Error('setView() must be called before draw()');

        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.STENCIL_TEST);

        // clamped so a stall or a tab switch advances one plausible frame instead of
        // teleporting everything; the first frame has no interval to measure
        const dt = this.lastFrame ? Math.min((now - this.lastFrame) / 1000, 0.1) : 1 / 60;
        this.lastFrame = now;

        util.bindTexture(gl, this.windTexture, 0);

        // update first: the step is what the segment draws, and once the view can move it's the
        // update pass that rebases the state into the current view the draw renders against
        this.updateParticles(dt);
        this.drawScreen(dt);
    }

    drawScreen(dt) {
        const gl = this.gl;
        // draw into a texture so this frame can serve as the next frame's background
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.screenTexture, 0);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        // 1/255 is gone in 8 bits, so trailDuration is the time to fade to that
        this.drawTexture(this.backgroundTexture, (1 / 255) ** (dt / this.trailDuration), Math.random());
        this.drawParticles();

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        // enable blending to support drawing on top of an existing background (e.g. a map)
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        this.drawTexture(this.screenTexture, 1.0);
        gl.disable(gl.BLEND);

        // save the current screen as the background for the next frame
        const temp = this.backgroundTexture;
        this.backgroundTexture = this.screenTexture;
        this.screenTexture = temp;
    }

    // `ditherSeed` of 0 draws the texture as is; anything else dithers the fade
    drawTexture(texture, opacity, ditherSeed = 0) {
        const gl = this.gl;
        const program = this.screenProgram;
        gl.useProgram(program);

        util.bindTexture(gl, texture, 2);
        gl.uniform1i(program.u_screen, 2);
        gl.uniform1f(program.u_opacity, opacity);
        gl.uniform1f(program.u_dither_seed, ditherSeed);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    drawParticles() {
        const gl = this.gl;
        const program = this.drawProgram;
        gl.useProgram(program);

        util.bindTexture(gl, this.particleStateTexture0, 1);
        util.bindTexture(gl, this.colorRampTexture, 2);

        gl.uniform1i(program.u_particles, 1);
        gl.uniform1i(program.u_color_ramp, 2);

        gl.uniform1i(program.u_particles_res, this.particleRes);
        gl.uniform2f(program.u_resolution, gl.canvas.width, gl.canvas.height);

        // two vertices per particle: the previous and the current position
        gl.drawArrays(gl.LINES, 0, this._numParticles * 2);
    }

    updateParticles(dt) {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.particleStateTexture1, 0);
        gl.viewport(0, 0, this.particleRes, this.particleRes);

        const program = this.updateProgram;
        gl.useProgram(program);

        util.bindTexture(gl, this.particleStateTexture0, 1);
        gl.uniform1i(program.u_wind, 0);
        gl.uniform1i(program.u_particles, 1);

        gl.uniform1f(program.u_rand_seed, Math.random());
        gl.uniform1f(program.u_dt, dt);
        gl.uniform2f(program.u_wind_res, this.windRes[0], this.windRes[1]);
        gl.uniform2f(program.u_view_min, ...viewMin(this.view));
        gl.uniform2f(program.u_view_span, ...viewSpan(this.view));
        gl.uniform1f(program.u_wind_step, this.windStep);
        gl.uniform1f(program.u_ramp_max_speed, this.rampMaxSpeed);
        // speeds are in CSS px so they mean the same thing at any device pixel ratio
        gl.uniform1f(program.u_speed_dt, this.speed * dt);
        gl.uniform2f(program.u_canvas_css, ...this.cssSize);
        // reciprocals, so Infinity turns into an exactly zero hazard
        gl.uniform1f(program.u_life_rate, 1 / this.particleLife);
        gl.uniform1f(program.u_travel_rate, 1 / this.particleTravel);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        // the texture just rendered into becomes the current state
        const temp = this.particleStateTexture0;
        this.particleStateTexture0 = this.particleStateTexture1;
        this.particleStateTexture1 = temp;
    }
}

function getColorRamp(colors) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = 256;
    canvas.height = 1;

    const gradient = ctx.createLinearGradient(0, 0, 256, 0);
    for (const stop in colors) {
        gradient.addColorStop(+stop, colors[stop]);
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 1);

    return new Uint8Array(ctx.getImageData(0, 0, 256, 1).data);
}

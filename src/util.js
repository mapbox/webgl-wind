
function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);

    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader));
    }

    return shader;
}

export function createProgram(gl, vertexSource, fragmentSource) {
    const program = gl.createProgram();

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);

    gl.linkProgram(program);
    // flagged for deletion before the link is checked, so a failed link doesn't leak them either;
    // they stay alive as long as the program they're attached to does
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const log = gl.getProgramInfoLog(program);
        gl.deleteProgram(program);
        throw new Error(log);
    }

    // uniform locations live on the program object itself: gl.uniform1f(program.u_opacity, ...)
    const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < numUniforms; i++) {
        const {name} = gl.getActiveUniform(program, i);
        // an array reports itself as `u_foo[0]`, and its location covers the whole array
        program[name.replace(/\[0\]$/, '')] = gl.getUniformLocation(program, name);
    }

    return program;
}

// `data` may be a typed array, an image or bitmap, or null to allocate storage only. Filtering
// defaults to NEAREST: the wind and state shaders interpolate themselves, and hardware filtering
// isn't guaranteed for float textures anyway. Only S can wrap — a wrapping T would blend the poles.
export function createTexture(gl, format, data, width, height, wrapS = gl.CLAMP_TO_EDGE, filter = gl.NEAREST) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);

    gl.texStorage2D(gl.TEXTURE_2D, 1, format, width, height);
    if (data) {
        // the default, BROWSER_DEFAULT_WEBGL, may rewrite the channels on upload; it's global
        // context state, so it goes back afterwards for whoever else uploads through this context
        gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RGBA,
            format === gl.RGBA32F ? gl.FLOAT : gl.UNSIGNED_BYTE, data);
        gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.BROWSER_DEFAULT_WEBGL);
    }
    gl.bindTexture(gl.TEXTURE_2D, null);
    return texture;
}

export function bindTexture(gl, texture, unit) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
}

// The context may belong to a host that draws its own layers through it, so everything a draw
// touches is read back on entry and put back on exit. Texture bindings are the one exception:
// restoring them would cost a query per unit, and a host that samples a texture binds it anyway.
export function saveState(gl) {
    return {
        framebuffer: gl.getParameter(gl.FRAMEBUFFER_BINDING),
        viewport: gl.getParameter(gl.VIEWPORT),
        activeTexture: gl.getParameter(gl.ACTIVE_TEXTURE),
        dither: gl.isEnabled(gl.DITHER),
        depth: gl.isEnabled(gl.DEPTH_TEST),
        stencil: gl.isEnabled(gl.STENCIL_TEST),
        blend: gl.isEnabled(gl.BLEND),
        blendEquation: [gl.getParameter(gl.BLEND_EQUATION_RGB), gl.getParameter(gl.BLEND_EQUATION_ALPHA)],
        blendFunc: [gl.getParameter(gl.BLEND_SRC_RGB), gl.getParameter(gl.BLEND_DST_RGB),
            gl.getParameter(gl.BLEND_SRC_ALPHA), gl.getParameter(gl.BLEND_DST_ALPHA)]
    };
}

export function restoreState(gl, state) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, state.framebuffer);
    gl.viewport(...state.viewport);
    gl.activeTexture(state.activeTexture);
    setEnabled(gl, gl.DITHER, state.dither);
    setEnabled(gl, gl.DEPTH_TEST, state.depth);
    setEnabled(gl, gl.STENCIL_TEST, state.stencil);
    setEnabled(gl, gl.BLEND, state.blend);
    gl.blendEquationSeparate(...state.blendEquation);
    gl.blendFuncSeparate(...state.blendFunc);
}

function setEnabled(gl, cap, enabled) {
    if (enabled) gl.enable(cap);
    else gl.disable(cap);
}

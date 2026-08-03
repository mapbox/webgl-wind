// The encoding is a contract between data/prepare.js and the decode line in the update
// shader, with no per-file metadata to reconcile them, so both sides come from here.
// Codes run 1..255 with zero exactly on 128; the mapping is affine, so it commutes with
// bilinear interpolation and the shader can blend codes and decode afterwards.

export const WIND_RANGE = 32; // m/s — the largest representable single component

// m/s per code; the shader gets this as u_wind_step
export const windStep = (range = WIND_RANGE) => range / 127;

export const encodeWind = (value, range = WIND_RANGE) => Math.round(128 + value / windStep(range));

export const decodeWind = (code, range = WIND_RANGE) => (code - 128) * windStep(range);

// Scales the vector until its largest component fits, preserving direction exactly —
// clamping the components independently would rotate the wind.
export function clampWind(u, v, range = WIND_RANGE) {
    const m = Math.max(Math.abs(u), Math.abs(v));
    return m > range ? [u * range / m, v * range / m] : [u, v];
}

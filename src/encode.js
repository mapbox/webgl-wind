// The encoding is a contract between data/prepare.js and the decode line in the update
// shader, so both sides come from here. Codes run 1..255 with zero exactly on 128; the
// mapping is affine, so it commutes with bilinear interpolation and the shader can blend
// codes and decode afterwards.
//
// The ±m/s range is a property of one image, not of the format: prepare.js measures it per
// frame and hands it to setWind(), so nothing here has to be kept in step with the weather,
// the height the wind is sampled at, or the model. Hence no default — a wrong range decodes
// silently into wrong speeds, which is worse than a missing argument.

// m/s per code; the shader gets this as u_wind_step
export const windStep = range => range / 127;

export const encodeWind = (value, range) => Math.round(128 + value / windStep(range));

export const decodeWind = (code, range) => (code - 128) * windStep(range);

import string from 'rollup-plugin-string';
import buble from 'rollup-plugin-buble';

export default {
    entry: 'src/index.js',
    dest: 'dist/wind-gl.js',
    format: 'umd',
    moduleName: 'WindGL',
    plugins: [
        string({include: './src/shaders/*.glsl'}),
        buble()
    ]
};

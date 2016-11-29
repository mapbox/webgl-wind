import string from 'rollup-plugin-string';
import buble from 'rollup-plugin-buble';

export default {
    entry: 'main.js',
    format: 'umd',
    moduleName: 'WindGL',
    plugins: [
        string({include: './src/shaders/*.glsl'}),
        buble()
    ]
};

import {rollup} from 'rollup';
import string from 'rollup-plugin-string';
import json from 'rollup-plugin-json';

export default {
    entry: 'main.js',
    format: 'umd',
    plugins: [
        json(),
        string({include: './src/shaders/*.glsl'})
    ]
};

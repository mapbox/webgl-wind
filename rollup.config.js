import {rollup} from 'rollup';
import string from 'rollup-plugin-string';

export default {
    entry: 'main.js',
    format: 'umd',
    plugins: [
        string({include: './src/shaders/*.glsl'})
    ]
};

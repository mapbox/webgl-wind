# rollup-plugin-string [![Build Status](https://travis-ci.org/TrySound/rollup-plugin-string.svg)](https://travis-ci.org/TrySound/rollup-plugin-string)

Converts text files to modules:

```js
import tpl from './tpl.html';
console.log( `Template for render: ${tpl}` );
```

## Installation

```sh
npm i rollup-plugin-string -D
```

## Usage

```js
import { rollup } from 'rollup';
import string from 'rollup-plugin-string';

rollup({
	entry: 'main.js',
	plugins: [
		string({
			// Required to be specified
			include: '**/*.html',

			// Undefined by default
			exclude: ['**/index.html']
		})
	]
});
```

# License

MIT © [Bogdan Chadkin](mailto:trysound@yandex.ru)

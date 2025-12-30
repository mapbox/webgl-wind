# rollup-plugin-buble

Convert ES2015 with buble.


## Installation

```bash
npm install --save-dev rollup-plugin-buble
```


## Usage

```js
import { rollup } from 'rollup';
import buble from 'rollup-plugin-buble';

rollup({
  entry: 'main.js',
  plugins: [ buble() ]
}).then(...)
```

## License

MIT

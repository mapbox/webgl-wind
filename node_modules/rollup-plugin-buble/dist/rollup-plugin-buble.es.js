import { transform } from 'buble';
import { createFilter } from 'rollup-pluginutils';

function buble$1 ( options ) {
	if ( !options ) options = {};
	var filter = createFilter( options.include, options.exclude );

	if ( !options.transforms ) options.transforms = {};
	options.transforms.modules = false;

	return {
		name: 'buble',

		transform: function ( code, id ) {
			if ( !filter( id ) ) return null;
			return transform( code, options );
		}
	};
}

export default buble$1;

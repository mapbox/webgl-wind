'use strict';

var buble = require('buble');
var rollupPluginutils = require('rollup-pluginutils');

function buble$1 ( options ) {
	if ( !options ) options = {};
	var filter = rollupPluginutils.createFilter( options.include, options.exclude );

	if ( !options.transforms ) options.transforms = {};
	options.transforms.modules = false;

	return {
		name: 'buble',

		transform: function ( code, id ) {
			if ( !filter( id ) ) return null;
			return buble.transform( code, options );
		}
	};
}

module.exports = buble$1;

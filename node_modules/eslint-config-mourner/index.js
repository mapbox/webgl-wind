module.exports = {
  "extends": "eslint:recommended",
  "env": {
    "node": true,
    "browser": true,
    "es6": true
  },
  "rules": {
    // disabling unnecessary recommended rules
    "no-console": 0,
    "no-constant-condition": 0,

    // best practices
    "accessor-pairs": 2,
    "array-callback-return": 2,
    "consistent-return": 2,
    "dot-location": [2, "property"],
    "eqeqeq": [2, "smart"],
    "no-caller": 2,
    "no-extend-native": 2,
    "no-extra-bind": 2,
    "no-extra-label": 2,
    "no-lone-blocks": 2,
    "no-loop-func": 2,
    "no-new-wrappers": 2,
    "no-return-assign": 2,
    "no-new": 2,
    "no-throw-literal": 2,
    "no-self-compare": 2,
    "no-sequences": 2,
    "no-void": 2,
    "no-eq-null": 2,
    "no-unmodified-loop-condition": 2,
    "no-unused-expressions": 2,
    "no-useless-call": 2,
    "no-useless-concat": 2,
    "no-with": 2,
    "yoda": 2,

    // strict mode
    "strict": [2, "global"],

    // variables
    "no-shadow-restricted-names": 2,
    "no-undef-init": 2,
    "no-label-var": 2,
    "no-use-before-define": [2, "nofunc"],

    // node-related
    "callback-return": 0,
    "global-require": 2,
    "handle-callback-err": 2,
    "no-mixed-requires": 2,
    "no-new-require": 2,
    "no-path-concat": 2,
    "no-process-exit": 2,

    // stylistic issues
    "array-bracket-spacing": 2,
    "block-spacing": 2,
    "brace-style": [2, "1tbs", {"allowSingleLine": true}],
    "camelcase": 2,
    "comma-spacing": 2,
    "comma-style": 2,
    "eol-last": 2,
    "indent": 2,
    "key-spacing": 2,
    "new-cap": 2,
    "new-parens": 2,
    "no-array-constructor": 2,
    "no-empty": 2,
    "no-lonely-if": 2,
    "no-new-object": 2,
    "no-spaced-func": 2,
    "no-trailing-spaces": 2,
    "no-unneeded-ternary": 2,
    "object-curly-spacing": 2,
    "operator-linebreak": [2, "after"],
    "semi-spacing": 2,
    "semi": 2,
    "keyword-spacing": 2,
    "space-before-blocks": 2,
    "space-before-function-paren": [2, {"anonymous": "always", "named": "never"}],
    "space-in-parens": 2,
    "space-infix-ops": 2,
    "space-unary-ops": 2,
    "quotes": [2, "single"]
  }
}

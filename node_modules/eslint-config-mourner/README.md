## eslint-config-mourner

A great [ESLint](http://eslint.org/) config with sensible defaults
that I use in [all my JavaScript projects](https://github.com/mourner/projects).

It is meant to be _strict_, enforcing as many useful rules and conventions as possible
to keep the code clean, elegant and consistent across projects.

The rules are easy to follow, so this is a good starting place for new projects,
while being easy to disable on a case by case basis for existing projects
if you want to enforce and fix them gradually or have justified exceptions.

### Install

To use it in your project, run:

```bash
npm install --save-dev eslint eslint-config-mourner
```

Then add a following `.eslintrc` file in the repo root:

```json
{
  "extends": "mourner"
}
```

Finally, add `eslint` to a `package.json` script:

```json
"scripts": {
  "lint": "eslint index.js test/test*.js",
  "pretest": "npm run lint"
}
```

Now run `npm run lint` and enjoy thousands of errors! :)

### Automatic fixes

To make things easier, you can run `eslint` with `--fix` option
that automatically fixes all simple errors like indentation and quotes for you.

### Overrides

Some of the rules may be too strict for your project,
but you can easily override any rules or options like this:

```json
{
  "extends": "eslint-config-mourner",
  "rules": {
    "space-before-function-paren": 0,
    "indent": [2, 2]
  },
  "env": {
    "mocha": true
  }
}
```

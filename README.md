# LibKit

Ember CLI blueprint for initializing a new TypeScript library,
developing it using VSCode and deploying it to NPM.

## Usage

```
$ npm install -g ember-cli
$ ember new -b libkit <package-name>
```

Write your library using `.ts` files instead of `.js` files and
libkit will take care of making things work.

The normal Ember CLI workflows work:

- `ember test -s` to run your tests in Node and in the browser
- `ember s` to serve your tests for use in a browser directly
- `ember init` to upgrade devkit
- `ember build` and `ember build -prod` to build your package

The normal NPM workflows work too:

- `npm publish` to publish your package, including Node modules (in
  CJS format), ES modules, and `.d.ts` files for other TypeScript
  consumers
- `npm test` to run the tests in CI mode

Integration with VSCode:

- `cmd-shift-b` to run TSLint and TypeScript type checking
- Debugger integration with full support for breakpoints
- Run tests with the debugger attached by pressing `f5`
- TDD workflow by running testem in an integrated terminal
  (`TDD` task)

Good defaults that work with the rest of the workflow:

- .gitignore
- .npmignore
- .travis.yml
- tsconfig.json
- tslint.json
- `import ... from 'your-package';` works in Ember and
  environments that support the `"module"` key in
  `package.json`.

All of these features should work on Windows (one of the main
authors uses a Windows machine to develop these packages).
We will prioritize any Windows bugs.

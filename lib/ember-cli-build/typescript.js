// @ts-check

const { typescript } = require("broccoli-typescript-compiler");
const fs = require("fs");
const path = require("path");
const BroccoliDebug = require('broccoli-debug');

const debug = BroccoliDebug.buildDebugCallback(`libkit:$typescript`);

exports.debug = debug;

exports.compile = function compile(input, annotation, name, tsconfig, pluginOptions) {
  input = debug(input, `$${annotation}:$before`);
  let output = typescript(input, Object.assign({
    tsconfig: Object.assign(tsconfig),
    annotation,
  }, pluginOptions));

  return debug(output, `$${annotation}:$after`);
};

exports.tsconfig = function tsconfig(root, compilerOptionsOverride) {
  let contents = fs.readFileSync(path.resolve(root, "tsconfig.json"), "utf-8");
  let parsed = new Function(`return ${contents}`)();

  parsed.compilerOptions = Object.assign(
    parsed.compilerOptions,
    compilerOptionsOverride
  );

  return parsed;
};

// @ts-check

const { typescript } = require("broccoli-typescript-compiler");
const fs = require("fs");
const path = require("path");
const BroccoliDebug = require('broccoli-debug');

const debug = BroccoliDebug.buildDebugCallback(`libkit:typescript`);

exports.compile = function compile(input, annotation, tsconfig, root) {
  input = debug(input, "before");
  let output = typescript(input, {
    tsconfig,
    annotation,
    rootPath: root
  });

  return debug(output, "after");
};

exports.tsconfig = function tsconfig(root, compilerOptionsOverride) {
  let contents = fs.readFileSync(path.resolve(root, "tsconfig.json"), "utf-8");
  let parsed = new Function(`return ${contents}`)();

  parsed.compilerOptions = Object.assign(
    parsed.compilerOptions,
    compilerOptionsOverride,
    { sourceRoot: path.dirname(root) }
  );

  return parsed;
};

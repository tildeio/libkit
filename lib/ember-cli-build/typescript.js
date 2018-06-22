// @ts-check

const { typescript } = require("broccoli-typescript-compiler");
const fs = require("fs");
const path = require("path");

exports.compile = function compile(input, annotation, tsconfig) {
  return typescript(input, {
    tsconfig,
    annotation
  });
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

// @ts-check

const typescript = require("broccoli-typescript-compiler").default;
const fs = require("fs");
const path = require("path");
const BroccoliDebug = require('broccoli-debug');

/**
 * @typedef {any} BroccoliTree
 * @typedef {(node: BroccoliTree, desc: string) => BroccoliTree} DebugFunction
 */

/**
 *
 * @param {Object} options
 * @param {BroccoliTree} options.input
 * @param {string} options.packageName
 * @param {Object} options.tsconfig
 * @param {Object} options.pluginOptions
 * @param {string} options.pluginOptions.rootPath
 * @param {boolean} options.pluginOptions.throwOnError
 * @returns {BroccoliTree}
 */
exports.compile = function compile(options) {
  let { input, packageName, tsconfig, pluginOptions } = options;

  let annotation = `${packageName}:${tsconfig.compilerOptions.module}`;

  return typescript(input, Object.assign({
    tsconfig: Object.assign(tsconfig),
    annotation,
  }, pluginOptions));
};

/**
 *
 * @param {string} packageRoot
 * @param {Object} compilerOptionsOverride
 * @returns {Object}
 */
exports.tsconfig = function tsconfig(packageRoot, compilerOptionsOverride) {
  let contents = fs.readFileSync(path.resolve(packageRoot, "tsconfig.json"), "utf-8");

  /** @type {Object} */
  let parsed = new Function(`return ${contents}`)();

  parsed.compilerOptions = Object.assign(
    parsed.compilerOptions,
    compilerOptionsOverride
  );

  return parsed;
};

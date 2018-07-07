// @ts-check

"use strict";

const fs = require("fs");
const path = require("path");

const funnel = require("broccoli-funnel");
const findWorkspaceRoot = require("find-yarn-workspace-root");
const merge = require("broccoli-merge-trees");
const glob = require("glob");
const BroccoliDebug = require('broccoli-debug');
const tee = require("broccoli-tee");
const getPackages = require("get-monorepo-packages");

const ts = require("./typescript");
const { tsconfig, compile: typescript } = ts;
const webpack = require("./webpack");

/**
 * @typedef {any} BroccoliTree
 * @typedef {(node: BroccoliTree, desc: string) => BroccoliTree} DebugFunction
 */


class BroccoliDebugger {
  constructor(relativeName) {
    this.step = 1;
    this.relativeName = relativeName;
    this.currentGroup = null;
  }

  /**
   *
   * @param {BroccoliTree} node
   * @param {string} desc
   * @returns {BroccoliTree}
   */
  debug(node, desc) {
    let split = desc.split(":");
    let left = split[0];
    let rest = split.slice(1).map(d => `[${d}]`);

    if (this.currentGroup) {
      let expanded = rest.length === 0 ? `[${left}]` : `[${left}]:[${rest}]`;
      return new BroccoliDebug(node, `libkit:[${this.relativeName}]:[${this.currentGroup}]:${expanded}`);
    } else {
      let expanded = rest.length === 0 ? `[${this.step++}. ${left}]` : `[${this.step++}.${left}]:[${rest}]`;
      return new BroccoliDebug(node, `libkit:[${this.relativeName}]:${expanded}`);
    }
  }

  /**
   * @template T
   * @param {string} desc
   * @param {() => T} callback
   * @returns {T}
   */
  group(desc, callback) {
    this.currentGroup = `${this.step++}. ${desc}`;
    let ret = callback();
    this.currentGroup = null;
    return ret;
  }
}

/**
 * This function is used in the `ember-cli-build.js` files in each package in the workspace. The rest of this
 * module assumes the use of Yarn workspaces in your repository.
 *
 * @example
 * module.exports = require("libkit").build({
 *   name: "@cross-check/core",
 *   root: __dirname
 * });
 *
 * @param {Object} options
 * @param {string} options.name the full name of the package (same as package.json)
 * @param {string=} options.relativeName the path to the package relative to the root of the `packages` directory
 * @param {string} options.root the root of the entire workspace
 * @returns {() => BroccoliTree}
 */
module.exports = function emberCliBuild(options) {
  let { name, relativeName, root } = options;
  relativeName = relativeName || path.basename(name);

  return function() {
    let broccoliDebugger = new BroccoliDebugger(relativeName);
    return buildPackage({ packageName: name, relativeName, packageRoot: root, broccoliDebugger });
  }
}

/**
 * The function that gets called when the main `ember-cli-build.js` for the workspace builds
 * this package.
 *
 * @param {Object} options
 * @param {string} options.packageName
 * @param {string} options.relativeName
 * @param {string} options.packageRoot
 * @param {BroccoliDebugger} options.broccoliDebugger
 *
 * @see emberCliBuild
 */
function buildPackage(options) {
  let { packageName, relativeName, packageRoot, broccoliDebugger } = options;

  let build = new PackageBuild(packageName, relativeName, packageRoot, broccoliDebugger, isDebugBuild());

  let sources = build.sources();

  /** @type {BroccoliTree[]} */
  let tsOutput = build.transpile();

  if (isDebugBuild()) {
    let testTree = build.tests(tsOutput);

    return build.debug(merge([
      tsOutput,
      testTree
    ]), "dev-build");
  } else {
    return build.debug(tsOutput, "prod-build");
  }

};

function isDevBuild() {
  return process.env.EMBER_ENV === "development";
}

function isTestBuild() {
  return process.env.EMBER_ENV === "test";
}

function isProdBuild() {
  return process.env.EMBER_ENV === "production";
}

function isDebugBuild() {
  return !isProdBuild();
}

class PackageBuild {
  /**
   * @param {string} packageName
   * @param {string} relativeName
   * @param {string} packageRoot
   * @param {BroccoliDebugger} broccoliDebugger
   * @param {boolean} isDebugBuild
   */
   constructor(packageName, relativeName, packageRoot, broccoliDebugger, isDebugBuild) {
     this.packageName = packageName;
     this.relativeName = relativeName;
     this.packageRoot = packageRoot;
     this.isDebugBuild = isDebugBuild;
     this.projectRoot = findWorkspaceRoot(packageRoot) || packageRoot;
     this.relativeRoot = path.relative(this.projectRoot, packageRoot);
     this.broccoliDebugger = broccoliDebugger;
  }

  /**
   * Copy the `src` directory (and if necessary the `test` directory) into a new
   * Broccoli tree with the same structure.
   *
   * If the input was:
   *
   * ```
   * |- src
   *   |- index.ts
   *   |- build.ts
   * |- test
   *   |- package-a-test.ts
   *   |- package-b-test.ts
   * |- index.js
   * |- package.json
   * |- tsconfig.json
   * |- tslint.json
   * |- .editorconfig
   * |- .travis.yml
   * ```
   *
   * The Broccoli tree returned by this function will be this in dev mode:
   *
   * ```
   * |- src
   *   |- index.ts
   *   |- build.ts
   * |- test
   *   |- package-a-test.ts
   *   |- package-b-test.ts
   * ```
   *
   * And this in prod mode:
   *
   * ```
   * |- src
   *   |- index.ts
   *   |- build.ts
   * ```
   *
   * @returns {BroccoliTree}
   */
  sources() {
    let src = [this.pick("src")];
    let annotation;

    if (isDebugBuild()) {
      src.push(this.pick("test"));
      annotation = "src+test";
    } else {
      annotation = "src"
    }

    return merge(src, {
      annotation: `source (${annotation})`
    });
  }

  /**
   * @private
   *
   * Copy a path from the package into the same location in the destination
   * directory.
   *
   * If the package root looks like:
   *
   * ```
   * |- src
   *   |- index.ts
   * |- package.json
   * |- yarn.lock
   * ```
   *
   * Calling `pick("src")` will produce a Broccoli tree that looks like:
   *
   * ```
   * |- src
   *   |- index.ts
   * ```
   *
   * @param {string} relative path relative to the package root
   * @returns {BroccoliTree}
   */
  pick(relative) {
    let absolutePath = path.resolve(this.packageRoot, relative);
    return funnel(absolutePath, { destDir: path.join(relative) });
  }

  /**
   * The source directories for this package are compiled into three
   * outputs:
   *
   * - [CommonJS]{@link PackageBuild#commonjs}
   * - [Modules]{@link PackageBuild#modules}
   * - [Types]{@link PackageBuild#types}
   */
  transpile() {
    let sources = this.sources();
    sources = this.debug(sources, "sources");

    let modules = this.debug(
      this.compileTypescriptModules(sources),
      "compiled-typescript"
    );

    let builds = this.group("targets", () => {
      return [
        this.debug(this.commonjs(sources), "commonjs"),
        this.debug(this.types(modules), "types"),
        this.debug(this.modules(modules), "modules")
      ];
    })

    return this.debug(merge(builds), "merged-builds");
  }

  /**
   * Compile the input tree into a CommonJS build.
   *
   * This takes an input tree from [sources]{@link PackageBuild#sources} and
   * compiles it into a CommonJS (node-compatible) directory.
   *
   * It uses the following TypeScript options:
   *
   * ```js
   * {
   *   module: "commonjs",
   *   target: "es2015",
   *   declaration: false
   * }
   * ```
   *
   * @param {BroccoliTree} input
   * @returns {BroccoliTree}
   */
  commonjs(input) {
    let output = typescript({
      input,
      packageName: this.packageName,
      tsconfig: this.tsconfig({ module: "commonjs", target: "es2015", declaration: false }),
      pluginOptions: this.tsPluginOptions()
    });

    return funnel(output,
      {
        destDir: "commonjs"
      }
    )
  }

  /**
   * Compile the input tree into a build containing ES2015 modules.
   *
   * This takes an input tree from [sources]{@link PackageBuild#sources} and
   * compiles it into a CommonJS (node-compatible) directory.
   *
   * It uses the following TypeScript options:
   *
   * ```js
   * {
   *   module: "es2015",
   *   target: "es2016",
   *   declaration: true
   * }
   * ```
   *
   * This is an intermediate step that is eventually split into a `types`
   * directory containing the `.d.ts` files and a `modules` directory
   * containing only the output `.js` files.
   *
   * If the input tree looks like this:
   *
   * ```
   * |- src
   *   |- index.ts
   *   |- build.ts
   * |- test
   *   |- my-package-test.ts
   * ```
   *
   * The output of the intermediate module tree will look like:
   *
   * ```
   * |- src
   *   |- index.d.ts
   *   |- index.js
   *   |- build.d.ts
   *   |- build.js
   * |- test
   *   |- my-package-test.d.ts
   *   |- my-package-test.js
   * ```
   *
   * @param {BroccoliTree} input
   * @returns {BroccoliTree}
   */
  compileTypescriptModules(input) {
    return typescript({
      input,
      packageName: this.packageName,
      tsconfig: this.tsconfig({ module: "es2015", target: "es2017", declaration: true }),
      pluginOptions: this.tsPluginOptions()
    });
  }

  /**
   * Extract the `.d.ts` files from the [compiled modules]{@link PackageBuild#compileTypescriptModules}
   * intermediate tree and copy them into their own directory.
   *
   * If the compiled modules tree looks like:
   *
   * ```
   * |- src
   *   |- index.d.ts
   *   |- index.js
   *   |- build.d.ts
   *   |- build.js
   * |- test
   *   |- my-package-test.d.ts
   *   |- my-package-test.js
   * ```
   *
   * The types tree will look like:
   *
   * ```
   * |- types
   *   |- src
   *     |- index.d.ts
   *     |- build.d.ts
   *   |- test
   *     |- my-package-test.d.ts
   * ```
   *
   * @param {BroccoliTree} input
   * @returns {BroccoliTree}
   */
  types(input) {
    return funnel(input, {
      include: ["**/*.d.ts"],
      destDir: "types"
    })
  }


  /**
   * Extract the `.js` files from the [compiled modules]{@link PackageBuild#compileTypescriptModules}
   * intermediate tree and copy them into their own `modules` directory.
   *
   * If the compiled modules tree looks like:
   *
   * ```
   * |- src
   *   |- index.d.ts
   *   |- index.js
   *   |- build.d.ts
   *   |- build.js
   * |- test
   *   |- my-package-test.d.ts
   *   |- my-package-test.js
   * ```
   *
   * The final modules tree will look like:
   *
   * ```
   * |- modules
   *   |- src
   *     |- index.js
   *     |- build.js
   *   |- test
   *     |- my-package-test.js
   * ```
   *
   * @param {BroccoliTree} input
   * @returns {BroccoliTree}
   */
  modules(input) {
    return funnel(input, {
      exclude: ["**/*.d.ts"],
      destDir: "modules"
    })
  }

  /**
   * Compile the modules into runnable tests.
   *
   * @param {BroccoliTree} modules
   * @returns {BroccoliTree}
   */
  tests(modules) {
    return this.group("tests", () => {
      let tests = this.debug(webpackTests(modules, this.packageName), `js`);

      let testHTML = funnel(path.resolve(this.projectRoot, "test"), {
        include: ["index.html", "index.testem.html"]
      });

      testHTML = this.debug(testHTML, `html`);

      let qunit = funnel(path.resolve(this.projectRoot, "node_modules", "qunit", "qunit"));

      let node_modules = this.debug(funnel(modules, {
        srcDir: "commonjs/src",
        destDir: `commonjs/test/node_modules/${this.packageName}`
      }), "node_modules");

      return merge([tests, testHTML, qunit, node_modules]);
    });
  }

  /**
   * @private
   * @param {BroccoliTree} node
   * @param {string} desc
   * @returns {BroccoliTree}
   */
  debug(node, desc) {
    return this.broccoliDebugger.debug(node, desc);
  }

  /**
   * @template T
   * @param {string} desc
   * @param {() => T} callback
   * @returns {T}
   */
  group(desc, callback) {
    return this.broccoliDebugger.group(desc, callback);
  }

  /**
   * @private
   */
  tsPluginOptions() {
    return {
      rootPath: this.packageRoot,
      throwOnError: false
    };
  }

  /**
   * @private
   * @param {Object} options
   * @param {"commonjs" | "es2015"} options.module
   * @param {boolean} options.declaration
   * @param {"es2015" | "es2017"} options.target
   */
  tsconfig(options) {
    return tsconfig(this.packageRoot, {
      module: options.module,
      target: "es2017",
      downlevelIteration: options.target === "es2015",
      declaration: options.declaration,
      sourceRoot: `file://${this.packageRoot}`
    })
  }
}

function webpackTests(testModules, packageName) {
  return webpack(testModules, {
    webpack: {
      bail: true,
      entry: () => glob.sync("modules/test/**/*-test.js"),
      output: {
        filename: "tests.js",
        devtoolModuleFilenameTemplate: "[absolute-resource-path]"
      },
      devtool: "inline-source-map",
      module: {
        rules: [
          {
            test: /\.js$/,
            use: [require.resolve("source-map-loader")],
            enforce: "pre"
          }
        ]
      },
      resolve: {
        alias: {
          [`${packageName}$`]: `modules/src/index.js`
        }
      }
    }
  });
}

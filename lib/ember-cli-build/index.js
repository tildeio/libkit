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

module.exports = function({ name, packageName, root }) {
  return function(d) {
    let packageName = path.basename(name);
    return _debug(packageName)(build({ name, packageName, packageRoot: root }), `merged`);
  }
}

/**
 * @param {string} packageName
 * @returns {(node: any, desc: string) => any}
 */
function _debug(packageName) {
  return (node, desc) => {
    let expandedDesc = desc.split(":").join(":$");
    return new BroccoliDebug(node, `libkit:$package:$${packageName}:$${expandedDesc}`);
  }
}

function build({ name, packageName, packageRoot }) {
  let projectRoot = findWorkspaceRoot(packageRoot);
  let relativeRoot = path.relative(projectRoot, packageRoot);

  let debug = _debug(packageName);

  function pick(relativePath) {
    let absolutePath = path.resolve(packageRoot, relativePath);
    return funnel(absolutePath, { destDir: path.join(relativePath) });
  }

  function abs(relativePath) {
    return path.join(packageRoot, relativePath);
  }

  let src = [pick("src")];

  if (!isProdBuild()) {
    src.push(pick("test"));
  }

  let input = merge(src, {
    annotation: "TypeScript Source"
  });

  let builds = [];

  builds.push(
    funnel(
      typescript(
        input,
        `${packageName}:$commonjs`,
        packageName,
        tsconfig(packageRoot, {
          module: "commonjs",
          target: "es2015",
          lib: "es2017",
          downlevelIteration: true,
          declaration: false,
          sourceRoot: `file://${packageRoot}`
        }),
        {
          rootPath: packageRoot,
          throwOnError: false
        }
      ),
      {
        destDir: "commonjs"
      }
    )
  );

  let modules = typescript(
    input,
    `$modules`,
    packageName,
    tsconfig(packageRoot, {
      module: "es2015",
      target: "es2017",
      declaration: true,
      sourceRoot: `file://${packageRoot}`
    }),
    {
      rootPath: packageRoot,
      throwOnError: false
    }
  );

  builds.push(
    ts.debug(funnel(modules, {
      include: ["**/*.d.ts"],
      destDir: "types"
    }), `$types`)
  );

  builds.push(
    funnel(modules, {
      exclude: ["**/*.d.ts"],
      destDir: "modules"
    })
  );

  /** @type {any} */
  let merged;

  if (isProdBuild()) {
    merged = debug(merge(builds), `prod-build`);
  } else {
    let mergedBuilds = merge(builds);

    let testTree = tests([mergedBuilds], name, packageName, projectRoot);

    merged = merge([
      mergedBuilds,
      testTree
    ]);
  }

  return merged;
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


function tests(modules, name, packageName, projectRoot) {
  let debug = _debug(packageName);

  let trees = debug(merge(modules), `webpack:before`);
  let tests = debug(webpackTests(trees, name), `webpack:after`);

  let testHTML = funnel(path.resolve(projectRoot, "test"), {
    include: ["index.html", "index.testem.html"]
  });

  testHTML = debug(testHTML, `dev-build:html`);

  let qunit = funnel(path.resolve(projectRoot, "node_modules", "qunit", "qunit"));

  return merge([tests, testHTML, qunit]);
}

function webpackTests(testModules, name) {
  return webpack(testModules, {
    webpack: {
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
            use: ["source-map-loader"],
            enforce: "pre"
          }
        ]
      },
      resolve: {
        alias: {
          [`${name}$`]: `modules/src/index.js`
        }
      }
    }
  });
}

function webpackAliases(root) {
  let aliases = {};

  for (let { package: pkg, location } of getPackages(root)) {
    console.log(location);
    aliases[pkg.name] = `${location}/dist/modules/src/index.js`;
  }

  console.log(aliases);

  return aliases;
}

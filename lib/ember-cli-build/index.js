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

const debug = BroccoliDebug.buildDebugCallback(`libkit:$package`);

const ts = require("./typescript");
const { tsconfig, compile: typescript } = ts;
const webpack = require("./webpack");

module.exports = function({ name, root }) {
  return function(d) {
    let packageName = path.basename(name);
    return debug(build({ name, packageName, packageRoot: root }), `$merged:$${packageName}`);
  }
}

function build({ name, packageName, packageRoot }) {
  let projectRoot = findWorkspaceRoot(packageRoot);
  let relativeRoot = path.relative(projectRoot, packageRoot);

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
          throwOnError: true
        }
      ),
      {
        destDir: "commonjs"
      }
    )
  );

  let modules = typescript(
    input,
    `${packageName}:$modules`,
    packageName,
    tsconfig(packageRoot, {
      module: "es2015",
      target: "es2017",
      declaration: true,
      sourceRoot: `file://${packageRoot}`
    }),
    {
      rootPath: packageRoot,
      throwOnError: true
    }
  );

  builds.push(
    ts.debug(funnel(modules, {
      include: ["**/*.d.ts"],
      destDir: "types"
    }), `$${packageName}:$types`)
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
    merged = merge(builds);
  } else {
    let mergedBuilds = merge(builds);

    let testHTML = funnel(abs("test"), { include: ["index.html"] });

    let qunit = funnel(path.resolve(projectRoot, "node_modules", "qunit", "qunit"));

    merged = merge([
      mergedBuilds,
      testHTML,
      qunit,
    ]);
  }

  return tee(merged, path.join(packageRoot, "dist"));
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

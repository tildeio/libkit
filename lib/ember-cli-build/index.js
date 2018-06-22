// @ts-check

"use strict";

const fs = require("fs");
const path = require("path");

const funnel = require("broccoli-funnel");
const findWorkspaceRoot = require("find-yarn-workspace-root");
const merge = require("broccoli-merge-trees");
const glob = require("glob");

const { tsconfig, compile: typescript } = require("./typescript");
const webpack = require("./webpack");

module.exports = function({ name, root: packageRoot }) {
  return function() {
    let projectRoot = findWorkspaceRoot(packageRoot);

    function pick(relativePath) {
      let absolutePath = path.resolve(packageRoot, relativePath);
      return funnel(absolutePath, { destDir: relativePath });
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
          "commonjs",
          tsconfig(packageRoot, {
            module: "commonjs",
            target: "es2015",
            lib: "es2017",
            downlevelIteration: true,
            declaration: false
          })
        ),
        { destDir: "commonjs" }
      )
    );

    if (isProdBuild()) {
      let modules = typescript(
        input,
        "modules",
        tsconfig(packageRoot, {
          module: "es2015",
          target: "es2017",
          declaration: true
        })
      );

      builds.push(
        funnel(modules, {
          include: ["**/*.d.ts"],
          destDir: "types"
        })
      );

      builds.push(
        funnel(modules, {
          exclude: ["**/*.d.ts"],
          destDir: "modules"
        })
      );

      return merge(builds);
    } else {
      let merged = merge(builds);

      let testHTML = funnel(abs("test"), { include: ["index.html"] });

      let testModules = funnel(
        typescript(
          input,
          "test",
          tsconfig(packageRoot, {
            module: "es2015",
            target: "es2015",
            lib: "es2017",
            declaration: false
          })
        )
      );

      let testBundle = webpack(testModules, {
        webpack: {
          entry: () => glob.sync("./test/**/*-test.js"),
          output: { filename: "tests.js" },
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
              [`${name}$`]: "src/index.js"
            }
          }
        }
      });

      let qunit = funnel(
        path.resolve(projectRoot, "node_modules", "qunit", "qunit")
      );

      return merge([
        merged,
        testHTML,
        testBundle,
        qunit,
        funnel(merged, {
          srcDir: "commonjs/src",
          destDir: `commonjs/test/node_modules/${name}`
        })
      ]);
    }
  };
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

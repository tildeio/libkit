// @ts-check

'use strict';

const fs = require('fs');
const path = require('path');

const funnel = require('broccoli-funnel');
const findWorkspaceRoot = require('find-yarn-workspace-root');
const merge = require('broccoli-merge-trees');
const glob = require('glob');

const typescript = require('./typescript');
const webpack = require('./webpack');

module.exports = function({ name }) {
  return function() {
    let cwd = process.cwd();
    let root = findWorkspaceRoot(cwd) || cwd;

    let src = [
      pick('src'),
      pick(path.resolve(root, 'node_modules'))
    ];

    if (!isProdBuild()) {
      src.push(pick('test'));
    }

    let input = merge(src, {
      annotation: 'TypeScript Source'
    });

    let builds = [];

    builds.push(funnel(
      typescript(input, 'commonjs', {
        module: 'commonjs',
        target: 'es2015',
        lib: 'es2017',
        downlevelIteration: true,
        declaration: false
      }),
      { destDir : 'commonjs' }
    ));

    if (isProdBuild()) {
      let modules = typescript(input, 'modules', {
        module: 'es2015',
        target: 'es2017',
        declaration: true
      });

      builds.push(funnel(modules, {
        include: ['**/*.d.ts'],
        destDir: 'types'
      }));

      builds.push(funnel(modules, {
        exclude: ['**/*.d.ts'],
        destDir: 'modules'
      }));

      return merge(builds);
    } else {
      let merged = merge(builds);

      let testHTML = funnel('test', { include: ['index.html'] });

      let testModules = funnel(
        typescript(input, 'test', {
          module: 'es2015',
          target: 'es2015',
          lib: 'es2017',
          declaration: false
        })
      );

      let testBundle = webpack(testModules, {
        webpack: {
          entry: () => glob.sync('./test/**/*-test.js'),
          output: { filename: 'tests.js' },
          devtool: 'inline-source-map',
          module: {
            rules: [{
              test: /\.js$/,
              use: ['source-map-loader'],
              enforce: 'pre'
            }]
          },
          resolve: {
            alias: {
              [`${name}$`]: 'src/index.js'
            }
          }
        }
      });

      let qunit = funnel(path.resolve(root, 'node_modules', 'qunitjs', 'qunit'));

      return merge([merged, testHTML, testBundle, qunit, funnel(merged, {
        srcDir: 'commonjs/src',
        destDir: `commonjs/test/node_modules/${name}`
      })]);
    }
  };
}

function pick(path) {
  return funnel(path, { destDir: path });
}

function isDevBuild() {
  return process.env.EMBER_ENV === 'development';
}

function isTestBuild() {
  return process.env.EMBER_ENV === 'test';
}

function isProdBuild() {
  return process.env.EMBER_ENV === 'production';
}

// @ts-check

const { typescript } = require('broccoli-typescript-compiler');
const fs = require('fs');

module.exports = function compile(input, annotation, compilerOptionsOverride) {
  return typescript(input, {
    tsconfig: tsconfig(compilerOptionsOverride),
    annotation
  });
}

function tsconfig(compilerOptionsOverride) {
  let contents = fs.readFileSync('./tsconfig.json', 'utf-8');
  let parsed = new Function(`return ${contents}`)();

  parsed.compilerOptions = Object.assign(parsed.compilerOptions, compilerOptionsOverride);

  return parsed;
}

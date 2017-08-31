'use strict';

const path = require('path');

exports.Formatter = class Formatter {
  format(failures) {
    let outputLines = failures.map(function (failure) {
      let fileName = path.relative(process.cwd(), failure.getFileName());
      let failureString = failure.getFailure();
      let ruleName = failure.getRuleName();
      let severity = failure.getRuleSeverity();
      let lineAndCharacter = failure.getStartPosition().getLineAndCharacter();
      let line = lineAndCharacter.line + 1;
      let character = lineAndCharacter.character + 1;
      return `${fileName} (${line},${character}): ${severity} TS1337: ${failureString} (${ruleName})`;
    });

    return outputLines.join('\n') + '\n';
  }
}

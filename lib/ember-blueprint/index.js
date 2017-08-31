const Blueprint = require('ember-cli/lib/models/blueprint');
const path = require('path');

module.exports = class extends Blueprint {
  get description() {
    return 'Ember CLI blueprint for initializing a new TypeScript library';
  }

  locals(options) {
    let name = options.entity.name;
    let packageName = this.project.pkg.name || name;
    let { libkitVersion } = require(path.resolve(__dirname, '..', '..', 'package'));
    let year = new Date().getFullYear();

    return { name, packageName, libkitVersion, year };
  }
}

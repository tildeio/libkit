'use strict';

module.exports = {
  description: 'Ember CLI blueprint for initializing a new TypeScript library',

  locals(options) {
    return { name: options.entity.name };
  }
};

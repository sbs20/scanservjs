/* eslint-env mocha */
const assert = require('assert');
const Config = require('../src/config');

describe('Config', () => {
  it.skip('scanimageVersion', () => {
    assert.strictEqual(Config.scanimageVersion, '1.0.31');
  });
});

/* eslint-env mocha */
const assert = require('assert');
const Config = require('../src/config');
const Context = require('../src/context');

describe('Context', () => {
  it('missing files', () => {
    const temp = Config.scanimage;
    Config.scanimage = '/x';
    const context = new Context([]);
    assert.strictEqual(context.diagnostics.length, 2);
    assert.strictEqual(context.diagnostics[0].success, false);
    Config.scanimage = temp;
  });
});
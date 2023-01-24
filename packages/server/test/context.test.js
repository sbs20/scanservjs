/* eslint-env mocha */
const assert = require('assert');
const Application = require('../src/application');
const Context = require('../src/classes/context');

const config = Application.config();

describe('Context', () => {
  it('missing files', () => {
    const temp = config.scanimage;
    config.scanimage = '/x';
    const context = new Context(config, []);
    assert.strictEqual(context.diagnostics.length, 2);
    assert.strictEqual(context.diagnostics[0].success, false);
    config.scanimage = temp;
  });
});

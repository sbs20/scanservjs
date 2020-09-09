/* eslint-env mocha */
const assert = require('assert');
const FileInfo = require('../src/server/FileInfo');

describe('FileInfo', () => {
  it('Basic file details', () => {
    const file = new FileInfo('./package.json');
    assert.strictEqual(file.exists(), true);
    assert.strictEqual(file.size > 0, true);
    assert.strictEqual(file.toText().indexOf('scanservjs is a simple web-based UI') > 0, true);
  });
  it('Security', () => {
    assert.throws(() => new FileInfo('../package.json'), Error, '../package.json');
    assert.throws(() => new FileInfo('/usr/bin/ls'), Error, '/usr/bin/ls');
  });
});
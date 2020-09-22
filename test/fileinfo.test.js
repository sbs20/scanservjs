/* eslint-env mocha */
const assert = require('assert');
const FileInfo = require('../server/file-info');

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

  it('Check file path variations', () => {
    const dir1 = new FileInfo('./test/resource');
    const dir2 = new FileInfo('test/resource');
    assert.strictEqual(dir1.equals(dir2), true);

    const file1 = new FileInfo('./test/resource/logo.png');
    const file2 = new FileInfo('test/resource/logo.png');
    assert.strictEqual(file1.equals(file2), true);
  });
});
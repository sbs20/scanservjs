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

  it('List file', () => {
    assert.rejects(async () => new FileInfo('../package.json').list(), Error, 'Not a directory');
  });

  it('List directory', async () => {
    const files = await new FileInfo('./test/resource').list();
    assert.strictEqual(files[0].name, 'logo.png');
    assert.strictEqual(files.length, 5);
    const stem = 'logo';
    const png = files.filter(f => new RegExp(`${stem}.png`).test(f.name));
    assert.strictEqual(png.length, 1);
  });

});
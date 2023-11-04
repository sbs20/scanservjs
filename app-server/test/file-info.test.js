/* eslint-env mocha */
const assert = require('assert');
const FileInfo = require('../src/classes/file-info');

describe('FileInfo', () => {
  it('Basic file details', () => {
    const file = FileInfo.create('./package.json');
    assert.strictEqual(file.exists(), true);
    assert.strictEqual(file.size > 0, true);
    assert.strictEqual(file.toText().indexOf('scanservjs-api is a REST based API') > 0, true);
  });

  it('Security', () => {
    assert.throws(
      () => FileInfo.unsafe('', '../package.json'),
      /Error: Name cannot contain illegal characters.*/);
    assert.throws(
      () => FileInfo.unsafe('', '/usr/bin/ls'),
      /Error: Name cannot contain illegal characters.*/);
  });

  it('Check file path variations', () => {
    const dir1 = FileInfo.create('./test/resource');
    const dir2 = FileInfo.create('test/resource');
    assert.strictEqual(dir1.equals(dir2), true);

    const file1 = FileInfo.create('./test/resource/logo.png');
    const file2 = FileInfo.create('test/resource/logo.png');
    assert.strictEqual(file1.equals(file2), true);
  });

  it('Check file path joins', () => {
    const dir1 = FileInfo.create('././test/resource');
    const dir2 = FileInfo.create('test/resource');
    assert.strictEqual(dir1.fullname, dir2.fullname);
  });

  it('List file', async () => {
    await assert.rejects(
      async () => FileInfo.create('./missing-file.txt').list(),
      /Error: .* does not exist/);
    await assert.rejects(
      async () => FileInfo.create('./package.json').list(),
      /Error: .* is not a directory/);
  });

  it('Directory trailing slash', () => {
    const dir1 = FileInfo.create('./test/resource');
    const dir2 = FileInfo.create('./test/resource/');

    assert.strictEqual(dir1.name, dir2.name);
    assert.strictEqual(dir1.fullname, dir2.fullname);
    assert.strictEqual(dir1.name.endsWith('/'), false);
    assert.strictEqual(dir1.fullname.endsWith('/'), false);
  });

  it('List directory', async () => {
    const files = await FileInfo.create('./test/resource').list();
    assert.strictEqual(files[0].name, 'logo.png');
    assert.strictEqual(files.length > 1, true);
    const stem = 'logo';
    const png = files.filter(f => new RegExp(`${stem}.png`).test(f.name));
    assert.strictEqual(png.length, 1);
  });

  it('Good unsafe', async () => {
    const file = FileInfo.unsafe('path/for/file', 'a1');
    assert.strictEqual(file.fullname, 'path/for/file/a1');
  });

  it('Illegal characters', async () => {
    assert.throws(() => FileInfo.unsafe('', 'a;1'), /Error: Name .* illegal char.*/);
    assert.throws(() => FileInfo.unsafe('', '/a1'), /Error: Name .* illegal char.*/);
    assert.throws(() => FileInfo.unsafe('', 'a/1'), /Error: Name .* illegal char.*/);
    assert.throws(() => FileInfo.unsafe('', '../a1'), /Error: Name .* illegal char.*/);
    assert.throws(() => FileInfo.unsafe('', 'a?1'), /Error: Name .* illegal char.*/);
    assert.throws(() => FileInfo.unsafe('', 'a<1'), /Error: Name .* illegal char.*/);
    assert.throws(() => FileInfo.unsafe('', 'a>1'), /Error: Name .* illegal char.*/);
  });

  it('Directory traversal', async () => {
    assert.throws(() => FileInfo.unsafe('', '../package.json'), /Error: Name .* illegal char.*/);
    assert.throws(() => FileInfo.unsafe('', '/package.json'), /Error: Name .* illegal char.*/);
    assert.throws(() => FileInfo.unsafe('test<', 'package.json'), /Error: Path .* illegal char.*/);
  });

  it('File move, rename and delete', async () => {
    let file = FileInfo.create('./test/resource/~tmp');
    file.save('Hello world');
    file = await file.move('./test/resource/~temp');

    let file2 = FileInfo.create('./test/resource/~tmp2');
    file2.save('Goodbye cruel world');
    await assert.rejects(
      async () => await file2.rename('~temp'),
      /Error: .*~temp already exists/);
    file2.delete();

    assert.strictEqual(FileInfo.create('./test/resource/~tmp').exists(), false);
    assert.strictEqual(FileInfo.create('./test/resource/~temp').exists(), true);

    await assert.rejects(
      async () => await file.rename('../thing'),
      /Error: Name .* illegal char.*/);
    file = await file.rename('~temporary');

    assert.strictEqual(FileInfo.create('./test/resource/~temp').exists(), false);
    assert.strictEqual(FileInfo.create('./test/resource/~temporary').exists(), true);

    file.delete();
    assert.strictEqual(FileInfo.create('./test/resource/~temporary').exists(), false);
  });
});

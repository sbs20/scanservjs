/* eslint-env mocha */
const assert = require('assert');
const FileInfo = require('../src/classes/file-info');
const Zip = require('../src/classes/zip');

describe('Zip', () => {
  it('deflate-inflate', async () => {
    const sources = (await FileInfo.create('./test/resource').list());
    const zipFile = FileInfo.create('/tmp/ss-test.zip');
    const zip = Zip.file(zipFile.fullname);
    zip.deflate(sources.map(f => f.fullname));

    assert.deepStrictEqual(
      sources.map(f => f.name).sort(),
      zip.list().sort()
    );

    zipFile.delete();
  });
});

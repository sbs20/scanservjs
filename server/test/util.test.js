/* eslint-env mocha */
const assert = require('assert');
const FileInfo = require('../src/file-info');
const Util = require('../src/util');

describe('Util', () => {
  it('collateReverse.1', () => {
    const files = Util.collateReverse([
      {name: 'scan-0001-1.tif'}
    ]);

    assert.deepStrictEqual(files, [
      {name: 'scan-0001-1.tif'}
    ]);
  });

  it('collateReverse.2', () => {
    const files = Util.collateReverse([
      {name: 'scan-0001-1.tif'},
      {name: 'scan-0001-2.tif'}
    ]);

    assert.deepStrictEqual(files, [
      {name: 'scan-0001-1.tif'},
      {name: 'scan-0001-2.tif'}
    ]);
  });

  it('collateReverse.3', () => {
    const files = Util.collateReverse([
      {name: 'scan-0001-1.tif'},
      {name: 'scan-0001-2.tif'},
      {name: 'scan-0002-1.tif'},
      {name: 'scan-0002-2.tif'},
      {name: 'scan-0003-1.tif'},
      {name: 'scan-0003-2.tif'}
    ]);

    assert.deepStrictEqual(files, [
      {name: 'scan-0001-1.tif'},
      {name: 'scan-0003-2.tif'},
      {name: 'scan-0002-1.tif'},
      {name: 'scan-0002-2.tif'},
      {name: 'scan-0003-1.tif'},
      {name: 'scan-0001-2.tif'}
    ]);
  });
});
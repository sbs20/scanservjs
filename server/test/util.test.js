/* eslint-env mocha */
const assert = require('assert');
const Util = require('../src/util');

describe('Util', () => {
  it('collate.1', () => {
    const files = Util.collate([
      {name: 'scan-1-0001.tif'}
    ]);

    assert.deepStrictEqual(files, [
      {name: 'scan-1-0001.tif'}
    ]);
  });

  it('collate.2', () => {
    const files = Util.collate([
      {name: 'scan-1-0001.tif'},
      {name: 'scan-2-0001.tif'}
    ]);

    assert.deepStrictEqual(files, [
      {name: 'scan-1-0001.tif'},
      {name: 'scan-2-0001.tif'}
    ]);
  });

  it('collate.3.standard', () => {
    const files = Util.collate([
      {name: 'scan-1-0001.tif'},
      {name: 'scan-1-0002.tif'},
      {name: 'scan-1-0003.tif'},
      {name: 'scan-2-0001.tif'},
      {name: 'scan-2-0002.tif'},
      {name: 'scan-2-0003.tif'}
    ], true);

    assert.deepStrictEqual(files, [
      {name: 'scan-1-0001.tif'},
      {name: 'scan-2-0003.tif'},
      {name: 'scan-1-0002.tif'},
      {name: 'scan-2-0002.tif'},
      {name: 'scan-1-0003.tif'},
      {name: 'scan-2-0001.tif'}
    ]);
  });

  it('collate.3.reverse', () => {
    const files = Util.collate([
      {name: 'scan-1-0001.tif'},
      {name: 'scan-1-0002.tif'},
      {name: 'scan-1-0003.tif'},
      {name: 'scan-2-0001.tif'},
      {name: 'scan-2-0002.tif'},
      {name: 'scan-2-0003.tif'}
    ], false);

    assert.deepStrictEqual(files, [
      {name: 'scan-1-0001.tif'},
      {name: 'scan-2-0001.tif'},
      {name: 'scan-1-0002.tif'},
      {name: 'scan-2-0002.tif'},
      {name: 'scan-1-0003.tif'},
      {name: 'scan-2-0003.tif'}
    ]);
  });
});
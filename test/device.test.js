/* eslint-env mocha */
const assert = require('assert');
const Device = require('../server/Device');
const FileInfo = require('../server/FileInfo');

describe('Device', () => {
  it('scanimage-a1.txt', () => {
    const file = new FileInfo('test/resource/scanimage-a1.txt');
    const device = Device.from(file.toText());

    assert.deepStrictEqual(device.features['--mode'].options, ['Lineart', 'Gray', 'Color']);
    assert.strictEqual(device.features['--mode'].default, 'Color');
    assert.deepStrictEqual(device.features['--resolution'].options, ['50', '75', '150', '300', '600', '1200']);
    assert.strictEqual(device.features['--resolution'].default, '50');
    assert.strictEqual(device.features['-l'].limits[0], 0);
    assert.strictEqual(device.features['-l'].limits[1], 215);
    assert.strictEqual(device.features['-t'].limits[0], 0);
    assert.strictEqual(device.features['-t'].limits[1], 297);
    assert.strictEqual(device.features['-x'].limits[0], 0);
    assert.strictEqual(device.features['-x'].limits[1], 215);
    assert.strictEqual(device.features['-y'].limits[0], 0);
    assert.strictEqual(device.features['-y'].limits[1], 297);
    assert.strictEqual(device.features['--brightness'].limits[0], -100);
    assert.strictEqual(device.features['--brightness'].limits[1], 100);
    assert.strictEqual(device.features['--brightness'].interval, 1);
    assert.strictEqual(device.features['--contrast'].limits[0], -100);
    assert.strictEqual(device.features['--contrast'].limits[1], 100);
    assert.strictEqual(device.features['--contrast'].interval, 1);
  });

  it('scanimage-a2.txt', () => {
    const file = new FileInfo('test/resource/scanimage-a2.txt');
    const device = Device.from(file.toText());

    assert.deepStrictEqual(device.features['--mode'].options, ['Lineart', 'Gray', 'Color']);
    assert.strictEqual(device.features['--mode'].default, 'Lineart');
    assert.deepStrictEqual(device.features['--resolution'].options, ['75', '300', '600', '1200']);
    assert.strictEqual(device.features['--resolution'].default, '75');
    assert.strictEqual(device.features['-l'].limits[0], 0);
    assert.strictEqual(device.features['-l'].limits[1], 215);
    assert.strictEqual(device.features['-t'].limits[0], 0);
    assert.strictEqual(device.features['-t'].limits[1], 297);
    assert.strictEqual(device.features['-x'].limits[0], 0);
    assert.strictEqual(device.features['-x'].limits[1], 215);
    assert.strictEqual(device.features['-y'].limits[0], 0);
    assert.strictEqual(device.features['-y'].limits[1], 297);
    assert.strictEqual(device.features['--brightness'], undefined);
    assert.strictEqual(device.features['--contrast'], undefined);
  });
});
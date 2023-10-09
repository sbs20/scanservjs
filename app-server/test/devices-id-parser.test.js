/* eslint-env mocha */
const assert = require('assert');
const DeviceIdParser = require('../src/classes/device-id-parser');
const FileInfo = require('../src/classes/file-info');

describe('DeviceIdParser', () => {
  it('scanimage-l1.txt', () => {
    const file = FileInfo.create('test/resource/scanimage-l1.txt');
    const deviceIds = new DeviceIdParser(file.toText()).ids();
    assert.deepStrictEqual(deviceIds, ['plustek:libusb:001:003']);
  });

  it('scanimage-l2.txt', () => {
    const file = FileInfo.create('test/resource/scanimage-l2.txt');
    const deviceIds = new DeviceIdParser(file.toText()).ids();
    assert.deepStrictEqual(deviceIds, [
      'plustek:libusb:001:003',
      'airscan:w1:CANON INC. TR8500 series',
      'airscan:e0:Canon TR8500 series']);
  });
});

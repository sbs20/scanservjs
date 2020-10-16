/* eslint-env mocha */
const assert = require('assert');
const Devices = require('../server/devices');
const FileInfo = require('../server/file-info');

describe('Devices', () => {
  it('scanimage-l1.txt', () => {
    const file = new FileInfo('test/resource/scanimage-l1.txt');
    const deviceIds = Devices._parseDevices(file.toText());
    assert.deepStrictEqual(deviceIds, ['plustek:libusb:001:003']);
  });

  it('scanimage-l2.txt', () => {
    const file = new FileInfo('test/resource/scanimage-l2.txt');
    const deviceIds = Devices._parseDevices(file.toText());
    assert.deepStrictEqual(deviceIds, [
      'plustek:libusb:001:003',
      'airscan:w1:CANON INC. TR8500 series',
      'airscan:e0:Canon TR8500 series']);
  });
});
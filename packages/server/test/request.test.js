/* eslint-env mocha */
const assert = require('assert');
const Context = require('../src/context');
const Device = require('../src/device');
const FileInfo = require('../src/file-info');
const Request = require('../src/request');

describe('Request', () => {
  it('scanimage-a1.txt', () => {
    const file = new FileInfo('test/resource/scanimage-a1.txt');
    const device = Device.from(file.toText());
    const context = new Context([device]);
    const request = new Request(context).extend({
      params: {
        deviceId: 'plustek:libusb:001:008',
        top: -1,
        left: -20,
        width: 400,
        height: 400,
        resolution: '150',
        mode: 'Color',
        brightness: 0,
        contrast: 0,
        dynamicLineart: true
      },
      pipeline: 'test-pipeline'
    });
    
    assert.strictEqual(request.params.deviceId, 'plustek:libusb:001:008');
    assert.strictEqual(request.params.mode, 'Color');
    assert.strictEqual(request.params.resolution, '150');
    assert.strictEqual(request.params.left, 0);
    assert.strictEqual(request.params.top, 0);
    assert.strictEqual(request.params.width, 215);
    assert.strictEqual(request.params.height, 297);
    assert.strictEqual(request.params.brightness, 0);
    assert.strictEqual(request.params.contrast, 0);
    assert.strictEqual(request.params.dynamicLineart, undefined);
  });

  it('scanimage-a2.txt', () => {
    const file = new FileInfo('test/resource/scanimage-a2.txt');
    const device = Device.from(file.toText());
    const context = new Context([device]);
    const request = new Request(context).extend({
      params: {
        deviceId: 'epson2:libusb:001:029',
        top: -1,
        left: -20,
        width: 400,
        height: 400,
        resolution: '150',
        mode: 'Color',
        brightness: 0,
        contrast: 0,
        dynamicLineart: true
      },
      pipeline: 'test-pipeline'
    });
    
    assert.strictEqual(request.params.deviceId, 'epson2:libusb:001:029');
    assert.strictEqual(request.params.mode, 'Color');
    assert.strictEqual(request.params.resolution, '150');
    assert.strictEqual(request.params.left, 0);
    assert.strictEqual(request.params.top, 0);
    assert.strictEqual(request.params.width, 215.9);
    assert.strictEqual(request.params.height, 297.1);
    assert.strictEqual(request.params.brightness, undefined);
    assert.strictEqual(request.params.contrast, undefined);
    assert.strictEqual(request.params.dynamicLineart, undefined);
  });
});
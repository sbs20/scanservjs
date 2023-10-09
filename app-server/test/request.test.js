/* eslint-env mocha */
const assert = require('assert');
const Application = require('../src/application');
const Context = require('../src/classes/context');
const Device = require('../src/classes/device');
const FileInfo = require('../src/classes/file-info');
const Request = require('../src/classes/request');
const UserOptions = require('../src/classes/user-options');

const config = Application.config();

describe('Request', () => {
  it('scanimage-a1.txt', () => {
    const file = FileInfo.create('test/resource/scanimage-a1.txt');
    const device = Device.from(file.toText());
    const context = new Context(config, [device], new UserOptions());
    const request = new Request(context, {
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
      pipeline: config.pipelines[0].description
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

  it('scanimage-a1-defaults.txt', () => {
    const file = FileInfo.create('test/resource/scanimage-a1.txt');
    const device = Device.from(file.toText());
    const context = new Context(config, [device], new UserOptions());
    const request = new Request(context, {
      params: {
        deviceId: 'plustek:libusb:001:008',
        mode: 'Color',
        brightness: 0,
        contrast: 0,
        dynamicLineart: true
      },
      pipeline: config.pipelines[0].description
    });

    assert.strictEqual(request.params.deviceId, 'plustek:libusb:001:008');
    assert.strictEqual(request.params.mode, 'Color');
    assert.strictEqual(request.params.resolution, 50);
    assert.strictEqual(request.params.left, 0);
    assert.strictEqual(request.params.top, 0);
    assert.strictEqual(request.params.width, 215);
    assert.strictEqual(request.params.height, 297);
    assert.strictEqual(request.params.brightness, 0);
    assert.strictEqual(request.params.contrast, 0);
    assert.strictEqual(request.params.dynamicLineart, undefined);
  });

  it('scanimage-a2.txt', () => {
    const file = FileInfo.create('test/resource/scanimage-a2.txt');
    const device = Device.from(file.toText());
    const context = new Context(config, [device], new UserOptions());
    const request = new Request(context, {
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
      pipeline: config.pipelines[0].description
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

  it('scanimage-a8.txt', () => {
    const file = FileInfo.create('test/resource/scanimage-a8.txt');
    const device = Device.from(file.toText());
    const context = new Context(config, [device], new UserOptions());
    const request = new Request(context, {
      params: {
        deviceId: 'umax1220u:libusb:001:004',
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
      pipeline: config.pipelines[0].description
    });

    assert.strictEqual(request.params.deviceId, 'umax1220u:libusb:001:004');
    assert.strictEqual(request.params.mode, undefined);
    assert.strictEqual(request.params.resolution, '150');
    assert.strictEqual(request.params.left, 0);
    assert.strictEqual(request.params.top, 0);
    assert.strictEqual(request.params.width, 228.6);
    assert.strictEqual(request.params.height, 298);
    assert.strictEqual(request.params.brightness, undefined);
    assert.strictEqual(request.params.contrast, undefined);
    assert.strictEqual(request.params.dynamicLineart, undefined);
  });

  it('scanimage-a10.txt', () => {
    const file = FileInfo.create('test/resource/scanimage-a10.txt');
    const device = Device.from(file.toText());
    const context = new Context(config, [device], new UserOptions());
    const request = new Request(context, {
      params: {
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
      pipeline: config.pipelines[0].description
    });

    assert.strictEqual(request.params.deviceId, 'epjitsu:libusb:001:003');
    assert.strictEqual(request.params.mode, 'Color');
    assert.strictEqual(request.params.resolution, '150');
    assert.strictEqual(request.params.left, undefined);
    assert.strictEqual(request.params.top, 0);
    assert.strictEqual(request.params.width, undefined);
    assert.strictEqual(request.params.height, undefined);
    assert.strictEqual(request.params.pageWidth, 215.8);
    assert.strictEqual(request.params.pageHeight, 292);
    assert.strictEqual(request.params.brightness, 0);
    assert.strictEqual(request.params.contrast, 0);
    assert.strictEqual(request.params.dynamicLineart, undefined);
  });

});

/* eslint-env mocha */
const assert = require('assert');
const Device = require('../src/device');
const FileInfo = require('../src/file-info');

describe('Device', () => {
  it('scanimage-a1.txt', () => {
    const file = FileInfo.create('test/resource/scanimage-a1.txt');
    const device = Device.from(file.toText());

    assert.strictEqual(device.id, 'plustek:libusb:001:008');
    assert.deepStrictEqual(device.features['--mode'].options, ['Lineart', 'Gray', 'Color']);
    assert.strictEqual(device.features['--mode'].default, 'Color');
    assert.strictEqual(device.features['--source'], undefined);
    assert.deepStrictEqual(device.features['--resolution'].options, [50, 75, 150, 300, 600, 1200]);
    assert.strictEqual(device.features['--resolution'].default, 50);
    assert.strictEqual(device.features['-l'].limits[0], 0);
    assert.strictEqual(device.features['-l'].limits[1], 215);
    assert.strictEqual(device.features['-l'].default, 0);
    assert.strictEqual(device.features['-t'].limits[0], 0);
    assert.strictEqual(device.features['-t'].limits[1], 297);
    assert.strictEqual(device.features['-t'].default, 0);
    assert.strictEqual(device.features['-x'].limits[0], 0);
    assert.strictEqual(device.features['-x'].limits[1], 215);
    assert.strictEqual(device.features['-x'].default, 103);
    assert.strictEqual(device.features['-y'].limits[0], 0);
    assert.strictEqual(device.features['-y'].limits[1], 297);
    assert.strictEqual(device.features['-y'].default, 76.2);
    assert.strictEqual(device.features['--brightness'].limits[0], -100);
    assert.strictEqual(device.features['--brightness'].limits[1], 100);
    assert.strictEqual(device.features['--brightness'].interval, 1);
    assert.strictEqual(device.features['--brightness'].default, 0);
    assert.strictEqual(device.features['--contrast'].limits[0], -100);
    assert.strictEqual(device.features['--contrast'].limits[1], 100);
    assert.strictEqual(device.features['--contrast'].interval, 1);
    assert.strictEqual(device.features['--contrast'].default, 0);
  });

  it('scanimage-a2.txt', () => {
    const file = FileInfo.create('test/resource/scanimage-a2.txt');
    const device = Device.from(file.toText());

    assert.strictEqual(device.id, 'epson2:libusb:001:029');
    assert.deepStrictEqual(device.features['--mode'].options, ['Lineart', 'Gray', 'Color']);
    assert.strictEqual(device.features['--mode'].default, 'Lineart');
    assert.strictEqual(device.features['--source'], undefined);
    assert.deepStrictEqual(device.features['--resolution'].options, [75, 300, 600, 1200]);
    assert.strictEqual(device.features['--resolution'].default, 75);
    assert.strictEqual(device.features['-l'].limits[0], 0);
    assert.strictEqual(device.features['-l'].limits[1], 215.9);
    assert.strictEqual(device.features['-l'].default, 0);
    assert.strictEqual(device.features['-t'].limits[0], 0);
    assert.strictEqual(device.features['-t'].limits[1], 297.1);
    assert.strictEqual(device.features['-t'].default, 0);
    assert.strictEqual(device.features['-x'].limits[0], 0);
    assert.strictEqual(device.features['-x'].limits[1], 215.9);
    assert.strictEqual(device.features['-x'].default, 215.9);
    assert.strictEqual(device.features['-y'].limits[0], 0);
    assert.strictEqual(device.features['-y'].limits[1], 297.1);
    assert.strictEqual(device.features['-y'].default, 297.1);
    assert.strictEqual(device.features['--brightness'], undefined);
    assert.strictEqual(device.features['--contrast'], undefined);
  });

  it('scanimage-a3.txt', () => {
    const file = FileInfo.create('test/resource/scanimage-a3.txt');
    const device = Device.from(file.toText());

    assert.strictEqual(device.id, 'magic');
    assert.deepStrictEqual(device.features['--mode'].options, ['Lineart', 'Gray', '24bitColor']);
    assert.strictEqual(device.features['--mode'].default, '24bitColor');
    assert.strictEqual(device.features['--source'], undefined);
    assert.deepStrictEqual(device.features['--resolution'].options, [75, 300, 600, 1200]);
    assert.strictEqual(device.features['--resolution'].default, 75);
    assert.strictEqual(device.features['-l'].limits[0], 0);
    assert.strictEqual(device.features['-l'].limits[1], 215.9);
    assert.strictEqual(device.features['-t'].limits[0], 0);
    assert.strictEqual(device.features['-t'].limits[1], 297.1);
    assert.strictEqual(device.features['-x'].limits[0], 0);
    assert.strictEqual(device.features['-x'].limits[1], 215.9);
    assert.strictEqual(device.features['-y'].limits[0], 0);
    assert.strictEqual(device.features['-y'].limits[1], 297.1);
    assert.strictEqual(device.features['--brightness'].limits[0], -50);
    assert.strictEqual(device.features['--brightness'].limits[1], 50);
    assert.strictEqual(device.features['--brightness'].interval, 1);
    assert.strictEqual(device.features['--brightness'].default, 0);
    assert.strictEqual(device.features['--contrast'].limits[0], -50);
    assert.strictEqual(device.features['--contrast'].limits[1], 50);
    assert.strictEqual(device.features['--contrast'].interval, 10);
    assert.strictEqual(device.features['--contrast'].default, 0);
  });

  it('scanimage-a4.txt', () => {
    const file = FileInfo.create('test/resource/scanimage-a4.txt');
    const device = Device.from(file.toText());

    assert.strictEqual(device.id, 'net:192.168.1.4:xerox_mfp:libusb:001:003');
    assert.deepStrictEqual(device.features['--mode'].options, ['Lineart', 'Halftone', 'Gray', 'Color']);
    assert.strictEqual(device.features['--mode'].default, 'Color');
    assert.deepStrictEqual(device.features['--source'].options, ['Flatbed', 'ADF', 'Auto']);
    assert.strictEqual(device.features['--source'].default, 'Flatbed');
    assert.deepStrictEqual(device.features['--resolution'].options, [75, 100, 150, 200, 300, 600, 1200]);
    assert.strictEqual(device.features['--resolution'].default, 150);
    assert.strictEqual(device.features['-l'].limits[0], 0);
    assert.strictEqual(device.features['-l'].limits[1], 215.9);
    assert.strictEqual(device.features['-t'].limits[0], 0);
    assert.strictEqual(device.features['-t'].limits[1], 297.1);
    assert.strictEqual(device.features['-x'].limits[0], 0);
    assert.strictEqual(device.features['-x'].limits[1], 215.9);
    assert.strictEqual(device.features['-y'].limits[0], 0);
    assert.strictEqual(device.features['-y'].limits[1], 297.1);
    assert.strictEqual(device.features['--brightness'], undefined);
    assert.strictEqual(device.features['--contrast'], undefined);
  });

  it('scanimage-a5.txt', () => {
    const file = FileInfo.create('test/resource/scanimage-a5.txt');
    const device = Device.from(file.toText());

    assert.strictEqual(device.id, 'pixma:04A91766_004AE4');
    assert.deepStrictEqual(device.features['--mode'].options, ['Color', 'Gray', 'Lineart']);
    assert.strictEqual(device.features['--mode'].default, 'Color');
    assert.deepStrictEqual(device.features['--source'].options, ['Flatbed', 'Automatic Document Feeder']);
    assert.strictEqual(device.features['--source'].default, 'Flatbed');
    assert.deepStrictEqual(device.features['--resolution'].options, [75, 150, 300, 600, 1200]);
    assert.strictEqual(device.features['--resolution'].default, 75);
    assert.strictEqual(device.features['-l'].limits[0], 0);
    assert.strictEqual(device.features['-l'].limits[1], 216);
    assert.strictEqual(device.features['-t'].limits[0], 0);
    assert.strictEqual(device.features['-t'].limits[1], 355.6);
    assert.strictEqual(device.features['-x'].limits[0], 0);
    assert.strictEqual(device.features['-x'].limits[1], 216);
    assert.strictEqual(device.features['-y'].limits[0], 0);
    assert.strictEqual(device.features['-y'].limits[1], 355.6);
    assert.strictEqual(device.features['--brightness'], undefined);
    assert.strictEqual(device.features['--contrast'], undefined);
  });

  it('scanimage-a6.txt', () => {
    const file = FileInfo.create('test/resource/scanimage-a6.txt');
    const device = Device.from(file.toText());

    assert.strictEqual(device.id, 'brother4:bus9;dev1');
    assert.deepStrictEqual(device.features['--mode'].options, ['Black & White', 'Gray[Error Diffusion]', 'True Gray', '24bit Color[Fast]']);
    assert.strictEqual(device.features['--mode'].default, '24bit Color[Fast]');
    assert.deepStrictEqual(device.features['--source'].options, ['FlatBed', 'Automatic Document Feeder(left aligned)', 'Automatic Document Feeder(left aligned,Duplex)', 'Automatic Document Feeder(centrally aligned)', 'Automatic Document Feeder(centrally aligned,Duplex)']);
    assert.strictEqual(device.features['--source'].default, 'Automatic Document Feeder(left aligned)');
    assert.deepStrictEqual(device.features['--resolution'].options, [100, 150, 200, 300, 400, 600, 1200, 2400, 4800, 9600]);
    assert.strictEqual(device.features['--resolution'].default, 200);
    assert.strictEqual(device.features['-l'].limits[0], 0);
    assert.strictEqual(device.features['-l'].limits[1], 215.9);
    assert.strictEqual(device.features['-t'].limits[0], 0);
    assert.strictEqual(device.features['-t'].limits[1], 355.6);
    assert.strictEqual(device.features['-x'].limits[0], 0);
    assert.strictEqual(device.features['-x'].limits[1], 215.9);
    assert.strictEqual(device.features['-y'].limits[0], 0);
    assert.strictEqual(device.features['-y'].limits[1], 355.6);
    assert.strictEqual(device.features['--brightness'], undefined);
    assert.strictEqual(device.features['--contrast'], undefined);
  });

  it('scanimage-a8.txt', () => {
    const file = FileInfo.create('test/resource/scanimage-a8.txt');
    const device = Device.from(file.toText());

    assert.strictEqual(device.id, 'umax1220u:libusb:001:004');
    assert.deepStrictEqual(device.features['--resolution'].options, [75, 150, 300, 600]);
    assert.strictEqual(device.features['--resolution'].default, 75);
    assert.strictEqual(device.features['-l'].limits[0], 0);
    assert.strictEqual(device.features['-l'].limits[1], 228.6);
    assert.strictEqual(device.features['-l'].default, 0);
    assert.strictEqual(device.features['-t'].limits[0], 0);
    assert.strictEqual(device.features['-t'].limits[1], 298);
    assert.strictEqual(device.features['-t'].default, 0);
    assert.strictEqual(device.features['-x'].limits[0], 0);
    assert.strictEqual(device.features['-x'].limits[1], 228.6);
    assert.strictEqual(device.features['-x'].default, 228.6);
    assert.strictEqual(device.features['-y'].limits[0], 0);
    assert.strictEqual(device.features['-y'].limits[1], 298);
    assert.strictEqual(device.features['-y'].default, 298);
  });

  it('scanimage-a9.txt', () => {
    const file = FileInfo.create('test/resource/scanimage-a9.txt');
    const device = Device.from(file.toText());

    assert.strictEqual(device.id, 'utsushi:esci:usb:/sys/devices/platform/soc/20980000.usb/usb1/1-1/1-1.2/1-1.2:1.0');
    assert.deepStrictEqual(device.features['--mode'].options, ['Monochrome', 'Grayscale', 'Color']);
    assert.strictEqual(device.features['--mode'].default, 'Color');
    assert.strictEqual(device.features['--source'], undefined);
    assert.deepStrictEqual(device.features['--resolution'].options, [50, 75, 150, 300, 600, 1200]);
    assert.strictEqual(device.features['--resolution'].default, 75);
    assert.strictEqual(device.features['-l'].limits[0], 0);
    assert.strictEqual(device.features['-l'].limits[1], 215.9);
    assert.strictEqual(device.features['-l'].default, 0);
    assert.strictEqual(device.features['-t'].limits[0], 0);
    assert.strictEqual(device.features['-t'].limits[1], 297.1);
    assert.strictEqual(device.features['-t'].default, 0);
    assert.strictEqual(device.features['-x'].limits[0], 0);
    assert.strictEqual(device.features['-x'].limits[1], 215.9);
    assert.strictEqual(device.features['-x'].default, 215.9);
    assert.strictEqual(device.features['-y'].limits[0], 0);
    assert.strictEqual(device.features['-y'].limits[1], 297.1);
    assert.strictEqual(device.features['-y'].default, 297.1);
  });
});
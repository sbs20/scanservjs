/* eslint-env mocha */
const assert = require('assert');
const Context = require('../src/classes/context');
const Device = require('../src/classes/device');
const FileInfo = require('../src/classes/file-info');
const Request = require('../src/classes/request');
const UserOptions = require('../src/classes/user-options');

const application = require('../src/application');
const scanimageCommand = application.scanimageCommand();

const requestScan = {
  params: {
    deviceId: 'deviceId',
    resolution: '150',
    format: 'TIF',
    isPreview: false
  }
};

const requestPreview = {
  params: {
    deviceId: 'deviceId',
    resolution: '150',
    format: 'TIF',
    isPreview: true
  }
};

function commandFor(version, request) {
  const temp = scanimageCommand.scanimage._version;
  scanimageCommand.scanimage._version = version;
  const command = scanimageCommand.scan(request);
  scanimageCommand.scanimage._version = temp;
  return command;
}

describe('ScanimageCommand', () => {
  it('scanimageVersion:1.0.27:scan', () => {
    const command = commandFor('1.0.27', requestScan);
    assert.match(command, /.*scanimage.* > data\/temp\/~tmp-scan-0-ined.tif/);
  });

  it('scanimageVersion:1.0.27:preview', () => {
    const command = commandFor('1.0.27', requestPreview);
    assert.match(command, /.*scanimage.* > data\/preview\/preview.tif/);
  });

  it('scanimageVersion:1.0.28:scan', () => {
    const command = commandFor('1.0.28', requestScan);
    assert.match(command, /.*scanimage.* -o data\/temp\/~tmp-scan-0-ined.tif/);
  });

  it('scanimageVersion:1.0.28:preview', () => {
    const command = commandFor('1.0.28', requestPreview);
    assert.match(command, /.*scanimage.* -o data\/preview\/preview.tif/);
  });

  it('scanimageVersion:1.0.31:scan', () => {
    const command = commandFor('1.0.31', requestScan);
    assert.match(command, /.*scanimage.* -o data\/temp\/~tmp-scan-0-ined.tif/);
  });

  it('scanimageVersion:1.0.31:preview', () => {
    const command = commandFor('1.0.31', requestPreview);
    assert.match(command, /.*scanimage.* -o data\/preview\/preview.tif/);
  });

  it('scanimage-a10.txt', () => {
    const file = FileInfo.create('test/resource/scanimage-a10.txt');
    const device = Device.from(file.toText());
    const context = new Context(application.config(), [device], new UserOptions());
    const request = new Request(context, {
      params: {
        mode: 'Color'
      }
    });
    const command = commandFor('1.0.31', request);

    // eslint-disable-next-line quotes
    assert.strictEqual(command, `/usr/bin/scanimage -d epjitsu:libusb:001:003 --source 'ADF Front' --mode Color --resolution 300 --page-width 215.8 --page-height 292 -t 0 --format tiff --brightness 0 --contrast 0 -o data/temp/~tmp-scan-0-0001.tif`);
  });

  it('scanimage-a14.txt', () => {
    const file = FileInfo.create('test/resource/scanimage-a14.txt');
    const device = Device.from(file.toText());
    const context = new Context(application.config(), [device], new UserOptions());
    const request = new Request(context, {
      params: {
        ald: 'yes'
      }
    });
    const command = commandFor('1.1.1', request);
    // eslint-disable-next-line quotes
    assert.strictEqual(command, `/usr/bin/scanimage -d 'fujitsu:ScanSnap S1500:8176' --source 'ADF Front' --mode Lineart --resolution 600 --page-width 215.8 --page-height 279.3 -l 0 -t 0 -x 215.8 -y 279.3 --format tiff --ald=yes --brightness 0 -o data/temp/~tmp-scan-0-0001.tif`);
  });

});

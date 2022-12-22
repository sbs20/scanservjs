/* eslint-env mocha */
const assert = require('assert');
const Scanimage = require('../src/scanimage');

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
  const temp = Scanimage.scanimage._version;
  Scanimage.scanimage._version = version;
  const command = Scanimage.scan(request);
  Scanimage.scanimage._version = temp;
  return command;
}

describe('ScanimageCommand', () => {
  it('scanimageVersion:1.0.27:scan', () => {
    const command = commandFor('1.0.27', requestScan);
    assert.ok(command.match(/.*scanimage.* > 'data\/temp\/~tmp-scan-0-ined.tif'/));
  });

  it('scanimageVersion:1.0.27:preview', () => {
    const command = commandFor('1.0.27', requestPreview);
    assert.ok(command.match(/.*scanimage.* > 'data\/preview\/preview.tif'/));
  });

  it('scanimageVersion:1.0.28:scan', () => {
    const command = commandFor('1.0.28', requestScan);
    assert.ok(command.match(/.*scanimage.* -o 'data\/temp\/~tmp-scan-0-ined.tif'/));
  });

  it('scanimageVersion:1.0.28:preview', () => {
    const command = commandFor('1.0.28', requestPreview);
    assert.ok(command.match(/.*scanimage.* -o 'data\/preview\/preview.tif'/));
  });

  it('scanimageVersion:1.0.31:scan', () => {
    const command = commandFor('1.0.31', requestScan);
    assert.ok(command.match(/.*scanimage.* -o 'data\/temp\/~tmp-scan-0-ined.tif'/));
  });

  it('scanimageVersion:1.0.31:preview', () => {
    const command = commandFor('1.0.31', requestPreview);
    assert.ok(command.match(/.*scanimage.* -o 'data\/preview\/preview.tif'/));
  });
});

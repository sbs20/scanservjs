/* eslint-env mocha */
const assert = require('assert');
const application = require('../src/application');
const Context = require('../src/classes/context');
const Device = require('../src/classes/device');
const FileInfo = require('../src/classes/file-info');
const SourceInfo = require('../src/classes/source-info');
const UserOptions = require('../src/classes/user-options');

const config = application.config();

describe('Device', () => {
  it('scanimage-a1.txt', () => {
    const file = FileInfo.create('test/resource/scanimage-a1.txt');
    const device = Device.from(file.toText());
    const sourceInfo = new SourceInfo(device);
    assert.deepEqual(sourceInfo, {});
  });

  it('scanimage-a4.txt', () => {
    const file = FileInfo.create('test/resource/scanimage-a4.txt');
    const device = Device.from(file.toText());
    const context = new Context(config, [device], new UserOptions());
    const sourceInfo = new SourceInfo(context.devices[0]);
    assert.deepEqual(sourceInfo, {
      'ADF': {
        'batchModes': [
          'auto',
          'auto-collate-standard'
        ],
        'isAdf': true
      },
      'Auto': {
        'batchModes': [
          'none',
          'manual'
        ],
        'isAdf': false
      },
      'Flatbed': {
        'batchModes': [
          'none',
          'manual'
        ],
        'isAdf': false
      }
    });
  });

  it('scanimage-a6.txt', () => {
    const file = FileInfo.create('test/resource/scanimage-a6.txt');
    const device = Device.from(file.toText());
    const context = new Context(config, [device], new UserOptions());
    const sourceInfo = new SourceInfo(context.devices[0]);
    assert.deepEqual(sourceInfo, {
      'Automatic Document Feeder(centrally aligned)': {
        'batchModes': [
          'auto',
          'auto-collate-standard'
        ],
        'isAdf': true
      },
      'Automatic Document Feeder(centrally aligned,Duplex)': {
        'batchModes': [
          'auto',
          'auto-collate-standard'
        ],
        'isAdf': true
      },
      'Automatic Document Feeder(left aligned)': {
        'batchModes': [
          'auto',
          'auto-collate-standard'
        ],
        'isAdf': true
      },
      'Automatic Document Feeder(left aligned,Duplex)': {
        'batchModes': [
          'auto',
          'auto-collate-standard'
        ],
        'isAdf': true
      },
      'FlatBed': {
        'batchModes': [
          'none',
          'manual'
        ],
        'isAdf': false
      }
    });
  });
});

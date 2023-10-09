/* eslint-env mocha */
const assert = require('assert');
const Regex = require('../src/classes/regex');

describe('Regex', () => {
  it('test.1', () => {
    const data = `device \`plustek:libusb:001:003' is a Canon CanoScan N670U/N676U/LiDE20 flatbed scanner
      device \`airscan:w1:CANON INC. TR8500 series' is a WSD CANON INC. TR8500 series WSD network scanner
      device \`airscan:e0:Canon TR8500 series' is a eSCL Canon TR8500 series eSCL network scanner`;

    const deviceIds = Regex.with(/device `?(.*)'.*/g)
      .matchAll(data)
      .map(m => m[1]);

    assert.deepStrictEqual(deviceIds, [
      'plustek:libusb:001:003',
      'airscan:w1:CANON INC. TR8500 series',
      'airscan:e0:Canon TR8500 series'
    ]);
  });
});

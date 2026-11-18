const assert = require('assert');
const Config = require('../src/classes/config');

const userOptions = { afterConfig() {} };

function devicesFindWith(value) {
  const original = process.env.SCANIMAGE_LIST_IGNORE;
  if (value === undefined) {
    delete process.env.SCANIMAGE_LIST_IGNORE;
  } else {
    process.env.SCANIMAGE_LIST_IGNORE = value;
  }
  try {
    return new Config(userOptions).devicesFind;
  } finally {
    if (original === undefined) {
      delete process.env.SCANIMAGE_LIST_IGNORE;
    } else {
      process.env.SCANIMAGE_LIST_IGNORE = original;
    }
  }
}

describe('Config', () => {
  it('SCANIMAGE_LIST_IGNORE unset or empty keeps device detection', () => {
    assert.strictEqual(devicesFindWith(undefined), true);
    assert.strictEqual(devicesFindWith(''), true);
  });

  it('SCANIMAGE_LIST_IGNORE false-like values keep device detection', () => {
    for (const value of ['false', 'False', 'FALSE', '0', 'no', 'off', ' false ']) {
      assert.strictEqual(devicesFindWith(value), true, `value: '${value}'`);
    }
  });

  it('SCANIMAGE_LIST_IGNORE other values disable device detection', () => {
    for (const value of ['true', 'True', '1', 'yes']) {
      assert.strictEqual(devicesFindWith(value), false, `value: '${value}'`);
    }
  });
});

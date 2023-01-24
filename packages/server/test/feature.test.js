/* eslint-env mocha */
const assert = require('assert');
const Feature = require('../src/classes/feature');

describe('Feature', () => {
  it('range-brightness', () => {
    const f = Feature.parse('--brightness -127..127 (in steps of 1) [0]');
    assert.strictEqual(f.name, '--brightness');
    assert.strictEqual(f.interval, 1);
    assert.strictEqual(f.default, 0);
    assert.strictEqual(f.enabled, true);
    assert.deepStrictEqual(f.limits, [-127, 127]);
  });

  it('range-contrast', () => {
    const f = Feature.parse('  --contrast 0..255 (in steps of 1) [120]');
    assert.strictEqual(f.name, '--contrast');
    assert.strictEqual(f.interval, 1);
    assert.strictEqual(f.default, 120);
    assert.strictEqual(f.enabled, true);
    assert.deepStrictEqual(f.limits, [0, 255]);
  });

  it('range-geometry1', () => {
    const f = Feature.parse('    -t 0..289.353mm (in steps of 0.0211639) [0]');
    assert.strictEqual(f.name, '-t');
    assert.strictEqual(f.interval, 0.0211639);
    assert.strictEqual(f.default, 0);
    assert.strictEqual(f.enabled, true);
    assert.deepStrictEqual(f.limits, [0, 289.3]);
  });

  it('range-geometry2', () => {
    const f = Feature.parse('    -l 0..215mm [0]');
    assert.strictEqual(f.name, '-l');
    assert.strictEqual(f.interval, 1);
    assert.strictEqual(f.default, 0);
    assert.strictEqual(f.enabled, true);
    assert.deepStrictEqual(f.limits, [0, 215]);
  });

  it('range-source-inactive', () => {
    const f = Feature.parse('    --source Normal|Transparency|Negative [inactive]');
    assert.strictEqual(f.name, '--source');
    assert.strictEqual(f.interval, undefined);
    assert.strictEqual(f.default, 'inactive');
    assert.strictEqual(f.enabled, false);
    assert.strictEqual(f.options, undefined);
  });

  it('range-resolution-range', () => {
    const f = Feature.parse('--resolution 50..1200dpi [50]');
    assert.strictEqual(f.name, '--resolution');
    assert.strictEqual(f.interval, 1);
    assert.strictEqual(f.default, 50);
    assert.strictEqual(f.enabled, true);
    assert.deepStrictEqual(f.options, [50, 75, 150, 300, 600, 1200]);
  });

  it('range-resolution-options', () => {
    const f = Feature.parse('--resolution 75|300|600|1200dpi [75]');
    assert.strictEqual(f.name, '--resolution');
    assert.strictEqual(f.interval, undefined);
    assert.strictEqual(f.default, 75);
    assert.strictEqual(f.enabled, true);
    assert.deepStrictEqual(f.options, [75, 300, 600, 1200]);
  });

});

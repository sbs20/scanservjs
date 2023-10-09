/* eslint-env mocha */
const assert = require('assert');
const ObjectMerger = require('../src/classes/object-merger');

const target = {
  a: 0,
  c: {
    x: 0,
    y: 0
  },
  d: [0, 1, 2],
  e: [1, 2, 4]
};

const source = {
  a: 1,
  b: 1,
  c: {
    x: 1
  },
  e: [1]
};

describe('ObjectMerger', () => {
  it('Object assign', () => {
    const result = ObjectMerger.deepMerge({}, target, source);
    assert.deepStrictEqual(result, {
      a: 1, // overwritten
      b: 1, // added
      c: { // merged
        x: 1, // overwritten
        y: 0 // left
      },
      d: [0, 1, 2], // left
      e: [1] // overwritten
    });
  });

  it('Deep merge', () => {
    const result = Object.assign({}, target, source);
    assert.deepStrictEqual(result, {
      a: 1, // overwritten
      b: 1, // added
      c: { // overwritten
        x: 1
      },
      d: [0, 1, 2], // left
      e: [1] // overwritten
    });
  });
});

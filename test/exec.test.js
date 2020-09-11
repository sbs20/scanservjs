/* eslint-env mocha */
const assert = require('assert');
const System = require('../server/System');

describe('Exec', () => {
  it('echo', async () => {
    const r = await System.execute('echo "hello world"');
    assert.strictEqual(r.output, 'hello world\n');
  });

  it('echo "1\\n2\\n3" | wc -l', async () => {
    const ls = await System.spawn('echo "1\n2\n3"');
    const result = await System.spawn('wc -l', ls);
    assert.strictEqual(result.toString(), '3\n');
    console.log(result);
  });

  it('cat ./test/resource/logo.png', async () => {
    const png = await System.spawn('cat ./test/resource/logo.png');
    assert.strictEqual(png.length, 3451);
  });

  it('cat ./test/resource/logo.png | convert - -quality 50 jpg:-', async () => {
    const png = await System.spawn('cat ./test/resource/logo.png');
    const jpg = await System.spawn('convert - -quality 50 jpg:-', png);
    // It should be about 4179 but different convert implementations may vary
    assert.strictEqual(jpg.length > 4000, true);
  });
});
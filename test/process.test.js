/* eslint-env mocha */
const assert = require('assert');
const CmdBuilder = require('../server/command-builder');
const Process = require('../server/process');

describe('Process', () => {
  it('echo', async () => {
    const result = await Process.execute(new CmdBuilder('echo').arg('hello world').build());
    assert.strictEqual(result, 'hello world\n');
  });

  it('echo-security', async () => {
    let result = null;
    result = await Process.execute(new CmdBuilder('echo').arg('-n', 'hello" && ls -al;# world').build());
    assert.strictEqual(result, 'hello" && ls -al;# world');

    result = await Process.execute(new CmdBuilder('echo').arg('-n', '`ls -al`').build());
    assert.strictEqual(result, '`ls -al`');

    result = await Process.execute(new CmdBuilder('echo').arg('-n', '$(date)').build());
    assert.strictEqual(result, '$(date)');
  });

  it('echo "1\\n2\\n3" | wc -l', async () => {
    const cmd = new CmdBuilder('echo').arg('"1\n2\n3"').build();
    assert.strictEqual(cmd, 'echo "1\n2\n3"');
    const ls = await Process.spawn(cmd);
    const result = await Process.spawn('wc -l', ls);
    assert.strictEqual(result.toString(), '3\n');
    console.log(result);
  });

  it('cat ./test/resource/logo.png', async () => {
    const png = await Process.spawn('cat ./test/resource/logo.png');
    assert.strictEqual(png.length, 3451);
  });

  it('spawn: cat ./test/resource/logo.png | convert - -quality 50 jpg:-', async () => {
    const png = await Process.spawn('cat ./test/resource/logo.png');
    const jpg = await Process.spawn('convert - -quality 50 jpg:-', png);
    // It should be about 4179 but different convert implementations may vary
    assert.strictEqual(jpg.length > 4000, true);
  });

  it('chain: cat ./test/resource/logo.png | convert - -quality 50 jpg:-', async () => {
    const cmds = [
      'cat ./test/resource/logo.png',
      'convert - -quality 50 jpg:-'
    ];
    const jpg = await Process.chain(cmds);
    // It should be about 4179 but different convert implementations may vary
    assert.strictEqual(jpg.length > 4000, true);
  });

  it('chain: cat ./test/resource/logo.png | convert - pdf:-', async () => {
    const cmds = [
      'cat ./test/resource/logo.png',
      'convert - pdf:-'
    ];
    const pdf = await Process.chain(cmds);
    assert.strictEqual(pdf.length > 4000, true);
  });

});
/* eslint-env mocha */
const assert = require('assert');
const CmdBuilder = require('../server/command-builder');

describe('CommandBuilder', () => {
  it('command-only', async () => {
    assert.strictEqual(new CmdBuilder('echo')
      .build(), 'echo');
  });

  it('command-arg', async () => {
    assert.strictEqual(new CmdBuilder('echo')
      .arg('hello world')
      .build(), 'echo hello world');
  });

  it('command-arg2', async () => {
    assert.strictEqual(new CmdBuilder('echo')
      .arg('-n', 'hello world')
      .build(), 'echo -n "hello world"');
  });

  it('command-security', async () => {
    assert.strictEqual(new CmdBuilder('echo')
      .arg('-n', 'hello" && ls -al;# world')
      .build(), 'echo -n "hello\\" && ls -al;# world"');
  });

  it('command-quotes"', async () => {
    assert.strictEqual(new CmdBuilder('echo')
      .arg('"1\n2\n3"')
      .build(), 'echo "1\n2\n3"');
  });
});
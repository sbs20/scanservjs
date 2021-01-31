/* eslint-env mocha */
const assert = require('assert');
const CmdBuilder = require('../src/command-builder');

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
      .build(), 'echo -n \'hello world\'');
  });

  it('command-security-1', async () => {
    assert.strictEqual(new CmdBuilder('echo')
      .arg('-n', 'hello" && ls -al;# world')
      .build(), 'echo -n \'hello" && ls -al;# world\'');
  });

  it('command-security-2', async () => {
    assert.throws(() => new CmdBuilder('echo')
      .arg('-n', 'hello\' && echo break shell')
      .build(), Error, 'Broke shell');
  });

  it('command-quotes"', async () => {
    assert.strictEqual(new CmdBuilder('echo')
      .arg('"1\n2\n3"')
      .build(), 'echo "1\n2\n3"');
  });
});
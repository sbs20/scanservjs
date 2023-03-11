/* eslint-env mocha */
const assert = require('assert');
const CommandBuilder = require('../src/classes/command-builder');

describe('CommandBuilder', () => {
  it('command-only', async () => {
    assert.strictEqual(
      new CommandBuilder('echo').build(),
      'echo');
  });

  it('command-arg', async () => {
    assert.strictEqual(
      new CommandBuilder('echo').arg('hello world').build(),
      'echo \'hello world\'');
  });

  it('command-arg-hash', async () => {
    assert.strictEqual(
      new CommandBuilder('echo').arg('-n', 'hello#world').build(),
      'echo -n \'hello#world\'');
  });

  it('command-arg-comma', async () => {
    assert.strictEqual(
      new CommandBuilder('echo').arg('-n', 'hello;world').build(),
      'echo -n \'hello;world\'');
  });

  it('command-security-1', async () => {
    assert.strictEqual(
      new CommandBuilder('echo').arg('-n', 'hello" && ls -al;# world').build(),
      'echo -n \'hello" && ls -al;# world\'');
  });

  it('command-security-2', async () => {
    assert.throws(
      () => new CommandBuilder('echo').arg('-n', 'hello\' && echo break shell').build(),
      Error,
      'Broke shell');
  });

  it('command-quotes"', async () => {
    assert.strictEqual(
      new CommandBuilder('echo').arg('"1\n2\n3"').build(),
      'echo "1\n2\n3"');
  });
});

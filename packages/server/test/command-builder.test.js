/* eslint-env mocha */
const assert = require('assert');
const CommandBuilder = require('../src/classes/command-builder');

describe('CommandBuilder', () => {
  it('command-only', async () => {
    assert.strictEqual(
      new CommandBuilder('echo').build(),
      'echo');
  });

  it('command-arg-number', async () => {
    assert.strictEqual(
      new CommandBuilder('echo').arg(1).build(),
      'echo 1');
  });

  it('command-arg-boolean', async () => {
    assert.strictEqual(
      new CommandBuilder('echo').arg(true).build(),
      'echo true');
  });

  it('command-arg-string-no-space', async () => {
    assert.strictEqual(
      new CommandBuilder('echo').arg('hello-world').build(),
      'echo hello-world');
  });

  it('command-arg-string-space', async () => {
    assert.strictEqual(
      new CommandBuilder('echo').arg('hello world').build(),
      'echo \'hello world\'');
  });

  it('command-arg-string-tab-backtick', async () => {
    assert.strictEqual(
      new CommandBuilder('echo').arg('`cat\t/etc/os-release\t1>&2`').build(),
      'echo \'`cat\t/etc/os-release\t1>&2`\'');
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

  it('command-arg-redirect', async () => {
    assert.strictEqual(
      new CommandBuilder('echo').arg('> thing').build(),
      'echo \'> thing\'');
  });

  it('command-security-1', async () => {
    assert.strictEqual(
      new CommandBuilder('echo').arg('-n', 'hello" && ls -al;# world').build(),
      'echo -n \'hello" && ls -al;# world\'');
  });

  it('command-security-2', async () => {
    assert.throws(
      () => new CommandBuilder('echo').arg('-n', 'hello\' && echo break shell').build(),
      /Error: Argument.*single quote.*/);
  });

  it('command-security-array', async () => {
    assert.throws(
      () => new CommandBuilder('echo').arg(['`cat /etc/os-release 1>&2`']).build(),
      /Error: Invalid argument.*object.*/);
  });

  it('command-security-object', async () => {
    assert.throws(
      () => new CommandBuilder('echo').arg({arg: '`cat /etc/os-release 1>&2`'}).build(),
      /Error: Invalid argument.*object.*/);
  });

  it('command-quotes"', async () => {
    assert.strictEqual(
      new CommandBuilder('echo').arg('"1\n2\n3"').build(),
      'echo \'"1\n2\n3"\'');
  });

  it('command-redirect-good"', async () => {
    assert.strictEqual(
      new CommandBuilder('echo').arg('"hello"').redirect('>').arg('output').build(),
      'echo \'"hello"\' > output');
  });

  it('command-redirect-bad-string', async () => {
    assert.throws(
      () => new CommandBuilder('echo').redirect('a').build(),
      /Error: Invalid argument.*/);
  });

  it('command-redirect-bad-number', async () => {
    assert.throws(
      () => new CommandBuilder('echo').redirect(1).build(),
      /Error: Invalid argument.*/);
  });

  it('command-redirect-bad-array', async () => {
    assert.throws(
      () => new CommandBuilder('echo').redirect(['invalid']).build(),
      /Error: Invalid argument.*/);
  });
});

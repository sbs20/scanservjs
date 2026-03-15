const path = require('path');
const PdfTool = require('./pdf-tool');
const Process = require('./process');
const log = require('loglevel').getLogger('PikepdfTool');

/**
 * PDF operations using pikepdf via a Python helper script.
 */
module.exports = class PikepdfTool extends PdfTool {
  /**
   * @param {string} projectRoot - absolute path to the project root
   */
  constructor(projectRoot) {
    super();
    this.python = path.join(projectRoot, '.venv/bin/python3');
    this.script = path.join(projectRoot, 'editor/pdf_ops.py');
  }

  /**
   * Build the command string for invoking pdf_ops.py
   * @param {string} command
   * @param  {...string} args
   * @returns {string}
   */
  _cmd(command, ...args) {
    const escaped = args.map(a => `'${a}'`);
    return `'${this.python}' '${this.script}' ${command} ${escaped.join(' ')}`;
  }

  /** @override */
  async getInfo(filePath) {
    const cmd = this._cmd('info', filePath);
    log.debug('getInfo:', cmd);
    const stdout = await Process.spawn(cmd);
    return JSON.parse(stdout.toString());
  }

  /** @override */
  async extractPage(filePath, pageNum, outputPath) {
    const cmd = this._cmd('extract', filePath, String(pageNum), outputPath);
    log.debug('extractPage:', cmd);
    await Process.spawn(cmd);
  }

  /** @override */
  async extractRotatePage(filePath, pageNum, degrees, outputPath) {
    const cmd = this._cmd('extract-rotate', filePath, String(pageNum),
      String(degrees), outputPath);
    log.debug('extractRotatePage:', cmd);
    await Process.spawn(cmd);
  }

  /** @override */
  async mergePages(inputPaths, outputPath) {
    const cmd = this._cmd('merge', outputPath, ...inputPaths);
    log.debug('mergePages:', cmd);
    await Process.spawn(cmd);
  }

  /** @override */
  async createBlank(widthPts, heightPts, outputPath) {
    const cmd = this._cmd('blank', String(widthPts), String(heightPts),
      outputPath);
    log.debug('createBlank:', cmd);
    await Process.spawn(cmd);
  }

  /**
   * Test whether pikepdf is available.
   * @param {string} projectRoot
   * @returns {Promise<boolean>}
   */
  static async isAvailable(projectRoot) {
    try {
      const python = path.join(projectRoot, '.venv/bin/python3');
      await Process.spawn(`'${python}' -c "import pikepdf"`);
      return true;
    } catch (e) {
      return false;
    }
  }
};

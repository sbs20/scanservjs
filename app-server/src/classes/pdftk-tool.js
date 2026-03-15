const PdfTool = require('./pdf-tool');
const Process = require('./process');
const log = require('loglevel').getLogger('PdftkTool');

const JAVA_ENV = { _JAVA_OPTIONS: '-Xmx128m' };

/**
 * PDF operations using pdftk-java + ImageMagick identify as fallback.
 */
module.exports = class PdftkTool extends PdfTool {
  constructor() {
    super();
  }

  /** @override */
  async getInfo(filePath) {
    log.debug('getInfo:', filePath);

    // Get page count via pdftk dump_data
    const dumpOutput = await Process.spawn(
      `pdftk '${filePath}' dump_data`, null, { env: { ...process.env, ...JAVA_ENV } });
    const dumpStr = dumpOutput.toString();
    const pageCountMatch = dumpStr.match(/NumberOfPages:\s*(\d+)/);
    const pageCount = pageCountMatch ? parseInt(pageCountMatch[1], 10) : 0;

    // Get dimensions for each page via identify
    const pages = [];
    for (let i = 0; i < pageCount; i++) {
      try {
        const identifyOut = await Process.spawn(
          `identify -format '%w %h' '${filePath}[${i}]'`);
        const parts = identifyOut.toString().trim().split(/\s+/);
        // identify returns pixels; for PDFs at default 72dpi, pixels ≈ points
        pages.push({
          width: parseFloat(parts[0]),
          height: parseFloat(parts[1])
        });
      } catch (e) {
        log.warn(`Failed to get dimensions for page ${i + 1}:`, e.message);
        pages.push({ width: 595, height: 842 }); // A4 fallback
      }
    }

    return { pages };
  }

  /** @override */
  async extractPage(filePath, pageNum, outputPath) {
    const cmd = `pdftk '${filePath}' cat ${pageNum} output '${outputPath}'`;
    log.debug('extractPage:', cmd);
    await Process.spawn(cmd, null, { env: { ...process.env, ...JAVA_ENV } });
  }

  /** @override */
  async extractRotatePage(filePath, pageNum, degrees, outputPath) {
    // pdftk rotation suffixes: north=0, east=90, south=180, west=270
    const rotationMap = { 90: 'east', 180: 'south', 270: 'west' };
    const suffix = rotationMap[degrees] || 'north';
    const cmd = `pdftk '${filePath}' cat ${pageNum}${suffix} output '${outputPath}'`;
    log.debug('extractRotatePage:', cmd);
    await Process.spawn(cmd, null, { env: { ...process.env, ...JAVA_ENV } });
  }

  /** @override */
  async mergePages(inputPaths, outputPath) {
    const inputs = inputPaths.map(p => `'${p}'`).join(' ');
    const cmd = `pdftk ${inputs} cat output '${outputPath}'`;
    log.debug('mergePages:', cmd);
    await Process.spawn(cmd, null, { env: { ...process.env, ...JAVA_ENV } });
  }

  /** @override */
  async createBlank(widthPts, heightPts, outputPath) {
    // Use ImageMagick to create a blank PDF page
    const cmd = `convert xc:white -page ${widthPts}x${heightPts} '${outputPath}'`;
    log.debug('createBlank:', cmd);
    await Process.spawn(cmd);
  }

  /**
   * Test whether pdftk is available.
   * @returns {Promise<boolean>}
   */
  static async isAvailable() {
    try {
      await Process.spawn('pdftk --version');
      return true;
    } catch (e) {
      return false;
    }
  }
};

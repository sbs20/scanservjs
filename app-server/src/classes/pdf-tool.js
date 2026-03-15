/**
 * Abstract base class for PDF operations.
 * Implementations: PikepdfTool (preferred), PdftkTool (fallback).
 */
module.exports = class PdfTool {
  /**
   * Get page metadata for a PDF file.
   * @param {string} filePath - absolute path to PDF
   * @returns {Promise<{pages: Array<{width: number, height: number}>}>}
   */
  async getInfo(filePath) {
    throw new Error('Not implemented');
  }

  /**
   * Extract a single page (1-based) to an output file.
   * @param {string} filePath - source PDF
   * @param {number} pageNum - 1-based page number
   * @param {string} outputPath - destination file
   * @returns {Promise<void>}
   */
  async extractPage(filePath, pageNum, outputPath) {
    throw new Error('Not implemented');
  }

  /**
   * Extract a single page and rotate it.
   * @param {string} filePath - source PDF
   * @param {number} pageNum - 1-based page number
   * @param {number} degrees - rotation in degrees (90, 180, 270)
   * @param {string} outputPath - destination file
   * @returns {Promise<void>}
   */
  async extractRotatePage(filePath, pageNum, degrees, outputPath) {
    throw new Error('Not implemented');
  }

  /**
   * Merge multiple PDF files into one.
   * @param {string[]} inputPaths - array of PDF file paths
   * @param {string} outputPath - destination file
   * @returns {Promise<void>}
   */
  async mergePages(inputPaths, outputPath) {
    throw new Error('Not implemented');
  }

  /**
   * Create a blank white PDF page.
   * @param {number} widthPts - width in points
   * @param {number} heightPts - height in points
   * @param {string} outputPath - destination file
   * @returns {Promise<void>}
   */
  async createBlank(widthPts, heightPts, outputPath) {
    throw new Error('Not implemented');
  }

  /**
   * Set the MediaBox of all pages to target dimensions (Tier 1, OCR-safe).
   * Adjusts only page metadata — content is not scaled.
   * @param {string} inputPath
   * @param {number} widthPts - target width in points
   * @param {number} heightPts - target height in points
   * @param {string} outputPath - destination file
   * @returns {Promise<void>}
   */
  async resizeMediaBox(inputPath, widthPts, heightPts, outputPath) {
    throw new Error('Not implemented');
  }
};

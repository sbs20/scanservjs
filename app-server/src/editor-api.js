const fs = require('fs');
const path = require('path');
const log = require('loglevel').getLogger('EditorApi');

const EditorSession = require('./classes/editor-session');
const PikepdfTool = require('./classes/pikepdf-tool');
const PdftkTool = require('./classes/pdftk-tool');

const application = require('./application');
const config = application.config();

module.exports = new class EditorApi {
  constructor() {
    /** @type {EditorSession|null} */
    this._session = null;
    /** @type {import('./classes/pdf-tool')|null} */
    this._pdfTool = null;
    this._toolDetected = false;
  }

  /**
   * Detect and initialize the best available PDF tool.
   * @returns {Promise<import('./classes/pdf-tool')>}
   */
  async _getPdfTool() {
    if (this._pdfTool) return this._pdfTool;

    if (await PikepdfTool.isAvailable()) {
      log.info('Using pikepdf for PDF operations');
      this._pdfTool = new PikepdfTool();
    } else if (await PdftkTool.isAvailable()) {
      log.info('Using pdftk-java fallback for PDF operations');
      this._pdfTool = new PdftkTool();
    } else {
      throw new Error(
        'No PDF tool available. Install pikepdf (pip install pikepdf) or pdftk-java.');
    }
    this._toolDetected = true;
    return this._pdfTool;
  }

  /**
   * Create a new editing session.
   * @param {string[]} files - filenames relative to outputDirectory
   * @returns {Promise<{sessionId: string, pages: Array}>}
   */
  async createSession(files) {
    // Single-session limit: destroy existing session
    if (this._session) {
      log.info(`Destroying existing session ${this._session.id} for new session`);
      this._session.destroy();
      this._session = null;
    }

    const pdfTool = await this._getPdfTool();
    const session = await EditorSession.create(files, config, pdfTool);
    this._session = session;
    log.info(`Created editor session ${session.id} with ${session.pages.length} pages`);

    return {
      sessionId: session.id,
      pages: session.pages
    };
  }

  /**
   * Get session metadata.
   * @param {string} id
   * @returns {{sessionId: string, pages: Array}}
   */
  getSession(id) {
    const session = this._requireSession(id);
    session.touch();
    return {
      sessionId: session.id,
      pages: session.pages
    };
  }

  /**
   * Get a page thumbnail.
   * @param {string} id
   * @param {number} pageIdx - 0-based
   * @returns {Promise<Buffer>}
   */
  async getThumbnail(id, pageIdx) {
    const session = this._requireSession(id);
    return await session.getThumbnail(pageIdx);
  }

  /**
   * Add pages from a file to the session.
   * @param {string} id
   * @param {string} file - filename relative to outputDirectory
   * @returns {Promise<{pages: Array}>}
   */
  async addPages(id, file) {
    const session = this._requireSession(id);
    const newPages = await session.addPages(file);
    return { pages: session.pages, added: newPages };
  }

  /**
   * Save the assembled document.
   * @param {string} id
   * @param {Array} editList
   * @param {string} filename
   * @param {{x: number, y: number}|null} [paperSize]
   * @param {'set-size'|'fit'|'fill'|null} [fitMode]
   * @param {boolean} [fitMargin]
   * @returns {Promise<{file: string}>}
   */
  async save(id, editList, filename, paperSize = null, fitMode = null, fitMargin = false) {
    const session = this._requireSession(id);
    await session.save(editList, filename, paperSize, fitMode, fitMargin);
    log.info(`Saved editor output: ${filename}`);
    return { file: filename };
  }

  /**
   * Assemble an ephemeral preview PDF from the current edit list.
   * @param {string} id
   * @param {Array} editList
   * @returns {Promise<{previewPath: string}>}
   */
  async assemblePreview(id, editList) {
    const session = this._requireSession(id);
    const previewPath = await session.assemblePreview(editList);
    log.info(`Assembled preview for session ${id}`);
    return { previewPath };
  }

  /**
   * Get the path to the preview PDF for a session.
   * @param {string} id
   * @returns {string} absolute path to preview.pdf
   */
  getPreviewPath(id) {
    const session = this._requireSession(id);
    session.touch();
    const previewPath = path.join(session.dir, 'preview.pdf');
    if (!fs.existsSync(previewPath)) {
      throw new Error('No preview available. Assemble a preview first.');
    }
    return previewPath;
  }

  /**
   * Delete a session and clean up.
   * @param {string} id
   */
  deleteSession(id) {
    const session = this._requireSession(id);
    session.destroy();
    this._session = null;
    log.info(`Deleted editor session ${id}`);
  }

  /**
   * Run startup cleanup: remove all orphaned editor sessions.
   */
  startupCleanup() {
    EditorSession.cleanupAll(config.tempDirectory);
  }

  /**
   * Run TTL-based cleanup for expired sessions.
   * @param {number} [maxAgeMs=3600000] - max age in ms (default 1 hour)
   */
  ttlCleanup(maxAgeMs = 3600000) {
    // Also check the active session
    if (this._session) {
      const age = Date.now() - this._session.lastAccessedAt.getTime();
      if (age > maxAgeMs) {
        log.info(`Active session ${this._session.id} expired`);
        this._session.destroy();
        this._session = null;
      }
    }
    EditorSession.cleanup(config.tempDirectory, maxAgeMs);
  }

  /**
   * Validate session exists and matches the given id.
   * @param {string} id
   * @returns {EditorSession}
   */
  _requireSession(id) {
    if (!this._session || this._session.id !== id) {
      throw new Error(`Session not found: ${id}`);
    }
    return this._session;
  }
};

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Process = require('./process');
const log = require('loglevel').getLogger('EditorSession');

const SESSION_PREFIX = 'editor-';
const THUMB_SIZE = 256;
const THUMB_QUALITY = 60;

/**
 * Represents a single editor session with its working directory, pages,
 * and lifecycle management.
 */
class EditorSession {
  /**
   * @param {string} id
   * @param {string} dir - absolute path to session directory
   * @param {Array} pages - page metadata array
   * @param {object} config - app config
   * @param {import('./pdf-tool')} pdfTool
   */
  constructor(id, dir, pages, config, pdfTool) {
    this.id = id;
    this.dir = dir;
    this.pages = pages;
    this.config = config;
    this.pdfTool = pdfTool;
    this.createdAt = new Date();
    this.lastAccessedAt = new Date();
  }

  /**
   * Create a new editor session from a list of files.
   * @param {string[]} files - filenames relative to outputDirectory
   * @param {object} config
   * @param {import('./pdf-tool')} pdfTool
   * @returns {Promise<EditorSession>}
   */
  static async create(files, config, pdfTool) {
    const id = crypto.randomUUID();
    const dir = path.join(config.tempDirectory, `${SESSION_PREFIX}${id}`);
    fs.mkdirSync(path.join(dir, 'pages'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'thumbs'), { recursive: true });

    const pages = [];
    for (const file of files) {
      const filePath = path.join(config.outputDirectory, file);
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${file}`);
      }
      const ext = path.extname(file).toLowerCase();
      if (ext === '.pdf') {
        const info = await pdfTool.getInfo(filePath);
        for (let i = 0; i < info.pages.length; i++) {
          pages.push({
            source: file,
            sourceType: 'pdf',
            pageNum: i + 1,
            width: info.pages[i].width,
            height: info.pages[i].height
          });
        }
      } else if (['.jpg', '.jpeg', '.png', '.tif', '.tiff', '.bmp', '.webp'].includes(ext)) {
        const dims = await EditorSession._getImageDimensions(filePath);
        pages.push({
          source: file,
          sourceType: 'image',
          pageNum: 1,
          width: dims.width,
          height: dims.height
        });
        // Symlink image into pages/ for easy access
        const linkPath = path.join(dir, 'pages', file);
        try {
          fs.symlinkSync(filePath, linkPath);
        } catch (e) {
          // Fallback: hardlink, then copy
          try {
            fs.linkSync(filePath, linkPath);
          } catch (e2) {
            fs.copyFileSync(filePath, linkPath);
          }
        }
      } else {
        throw new Error(`Unsupported file type: ${ext}`);
      }
    }

    const session = new EditorSession(id, dir, pages, config, pdfTool);
    session._saveManifest();
    return session;
  }

  /**
   * Get image dimensions via ImageMagick identify.
   * @param {string} filePath
   * @returns {Promise<{width: number, height: number}>}
   */
  static async _getImageDimensions(filePath) {
    const stdout = await Process.spawn(
      `identify -format '%w %h' '${filePath}[0]'`);
    const parts = stdout.toString().trim().split(/\s+/);
    return { width: parseFloat(parts[0]), height: parseFloat(parts[1]) };
  }

  /**
   * Get a thumbnail for a page. Lazy: generates on first request.
   * @param {number} pageIdx - 0-based index into this.pages
   * @returns {Promise<Buffer>}
   */
  async getThumbnail(pageIdx) {
    this.touch();
    if (pageIdx < 0 || pageIdx >= this.pages.length) {
      throw new Error(`Page index out of range: ${pageIdx}`);
    }

    const thumbPath = path.join(this.dir, 'thumbs', `page-${String(pageIdx).padStart(4, '0')}.jpg`);
    if (fs.existsSync(thumbPath)) {
      return fs.readFileSync(thumbPath);
    }

    const page = this.pages[pageIdx];
    const sourcePath = path.join(this.config.outputDirectory, page.source);

    let buffer;
    if (page.sourceType === 'pdf') {
      // Extract the page first if not yet extracted
      const extractedPath = await this._ensurePageExtracted(pageIdx);
      buffer = await Process.spawn(
        `convert '${extractedPath}[0]' -background white -flatten -resize ${THUMB_SIZE} -quality ${THUMB_QUALITY} jpg:-`);
    } else {
      // Image: generate thumbnail directly from source
      buffer = await Process.spawn(
        `convert '${sourcePath}[0]' -background white -flatten -resize ${THUMB_SIZE} -quality ${THUMB_QUALITY} jpg:-`);
    }

    fs.writeFileSync(thumbPath, buffer);
    return buffer;
  }

  /**
   * Ensure a PDF page is extracted to the pages/ directory.
   * @param {number} pageIdx - 0-based
   * @returns {Promise<string>} path to extracted page file
   */
  async _ensurePageExtracted(pageIdx) {
    const pagePath = path.join(this.dir, 'pages', `page-${String(pageIdx).padStart(4, '0')}.pdf`);
    if (fs.existsSync(pagePath)) {
      return pagePath;
    }
    const page = this.pages[pageIdx];
    const sourcePath = path.join(this.config.outputDirectory, page.source);
    await this.pdfTool.extractPage(sourcePath, page.pageNum, pagePath);
    return pagePath;
  }

  /**
   * Add pages from another file to this session.
   * @param {string} file - filename relative to outputDirectory
   * @returns {Promise<Array>} the new pages added
   */
  async addPages(file) {
    this.touch();
    const filePath = path.join(this.config.outputDirectory, file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${file}`);
    }

    const ext = path.extname(file).toLowerCase();
    const newPages = [];

    if (ext === '.pdf') {
      const info = await this.pdfTool.getInfo(filePath);
      for (let i = 0; i < info.pages.length; i++) {
        newPages.push({
          source: file,
          sourceType: 'pdf',
          pageNum: i + 1,
          width: info.pages[i].width,
          height: info.pages[i].height
        });
      }
    } else if (['.jpg', '.jpeg', '.png', '.tif', '.tiff', '.bmp', '.webp'].includes(ext)) {
      const dims = await EditorSession._getImageDimensions(filePath);
      newPages.push({
        source: file,
        sourceType: 'image',
        pageNum: 1,
        width: dims.width,
        height: dims.height
      });
      const linkPath = path.join(this.dir, 'pages', file);
      if (!fs.existsSync(linkPath)) {
        try {
          fs.symlinkSync(filePath, linkPath);
        } catch (e) {
          try {
            fs.linkSync(filePath, linkPath);
          } catch (e2) {
            fs.copyFileSync(filePath, linkPath);
          }
        }
      }
    } else {
      throw new Error(`Unsupported file type: ${ext}`);
    }

    this.pages.push(...newPages);
    this._saveManifest();
    return newPages;
  }

  /**
   * Prepare and merge pages from an edit list into a single PDF.
   * Shared by save() and assemblePreview().
   * @param {Array} editList - array of {source, pageNum, rotation, isBlank, width, height, sourceType}
   * @returns {Promise<string>} path to assembled PDF
   */
  async _assemblePages(editList) {
    const preparedPaths = [];

    for (let i = 0; i < editList.length; i++) {
      const entry = editList[i];
      const prepPath = path.join(this.dir, 'pages', `prepared-${String(i).padStart(4, '0')}.pdf`);

      if (entry.isBlank) {
        await this.pdfTool.createBlank(
          entry.width || 595, entry.height || 842, prepPath);
      } else if (entry.sourceType === 'pdf') {
        const sourcePath = path.join(this.config.outputDirectory, entry.source);
        if (entry.rotation && entry.rotation !== 0) {
          await this.pdfTool.extractRotatePage(
            sourcePath, entry.pageNum, entry.rotation, prepPath);
        } else {
          await this.pdfTool.extractPage(sourcePath, entry.pageNum, prepPath);
        }
      } else {
        // Image: convert to PDF, with optional rotation
        const sourcePath = path.join(this.config.outputDirectory, entry.source);
        if (entry.rotation && entry.rotation !== 0) {
          await Process.spawn(
            `convert '${sourcePath}' -rotate ${entry.rotation} '${prepPath}'`);
        } else {
          await Process.spawn(`convert '${sourcePath}' '${prepPath}'`);
        }
      }

      preparedPaths.push(prepPath);
    }

    // Merge all prepared pages
    const assembledPath = path.join(this.dir, 'assembled.pdf');
    if (preparedPaths.length === 1) {
      fs.copyFileSync(preparedPaths[0], assembledPath);
    } else {
      await this.pdfTool.mergePages(preparedPaths, assembledPath);
    }

    return assembledPath;
  }

  /**
   * Save the final document from an edit list.
   * @param {Array} editList - array of {source, pageNum, rotation, isBlank, width, height}
   * @param {string} filename - output filename
   * @returns {Promise<string>} path to saved file
   */
  async save(editList, filename) {
    this.touch();
    const assembledPath = await this._assemblePages(editList);

    // Atomic write to output directory
    const tempOutputPath = path.join(this.config.outputDirectory, `.tmp-${this.id}.pdf`);
    const finalPath = path.join(this.config.outputDirectory, filename);
    fs.copyFileSync(assembledPath, tempOutputPath);
    fs.renameSync(tempOutputPath, finalPath);

    // Invalidate thumbnail cache for this filename
    const thumbPath = path.join(this.config.thumbnailDirectory, filename);
    if (fs.existsSync(thumbPath)) {
      fs.unlinkSync(thumbPath);
    }

    return finalPath;
  }

  /**
   * Assemble an ephemeral preview PDF from the current edit list.
   * Overwrites any previous preview in the session directory.
   * @param {Array} editList - array of {source, pageNum, rotation, isBlank, width, height, sourceType}
   * @returns {Promise<string>} path to preview.pdf
   */
  async assemblePreview(editList) {
    this.touch();
    const assembledPath = await this._assemblePages(editList);
    const previewPath = path.join(this.dir, 'preview.pdf');
    fs.copyFileSync(assembledPath, previewPath);
    return previewPath;
  }

  /** Update lastAccessedAt timestamp. */
  touch() {
    this.lastAccessedAt = new Date();
  }

  /** Remove the entire session directory. */
  destroy() {
    try {
      fs.rmSync(this.dir, { recursive: true, force: true });
    } catch (e) {
      log.warn(`Failed to clean up session ${this.id}:`, e.message);
    }
  }

  /** Save manifest.json to session directory. */
  _saveManifest() {
    const manifest = {
      id: this.id,
      pages: this.pages,
      createdAt: this.createdAt.toISOString(),
      lastAccessedAt: this.lastAccessedAt.toISOString()
    };
    fs.writeFileSync(
      path.join(this.dir, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );
  }

  /**
   * Remove all editor session directories from temp (startup cleanup).
   * @param {string} tempDir
   */
  static cleanupAll(tempDir) {
    if (!fs.existsSync(tempDir)) return;
    const entries = fs.readdirSync(tempDir);
    for (const entry of entries) {
      if (entry.startsWith(SESSION_PREFIX)) {
        const fullPath = path.join(tempDir, entry);
        try {
          fs.rmSync(fullPath, { recursive: true, force: true });
          log.info(`Cleaned up orphaned session: ${entry}`);
        } catch (e) {
          log.warn(`Failed to clean up ${entry}:`, e.message);
        }
      }
    }
  }

  /**
   * Remove expired session directories (TTL-based cleanup).
   * @param {string} tempDir
   * @param {number} maxAgeMs - maximum age in milliseconds
   */
  static cleanup(tempDir, maxAgeMs) {
    if (!fs.existsSync(tempDir)) return;
    const now = Date.now();
    const entries = fs.readdirSync(tempDir);
    for (const entry of entries) {
      if (!entry.startsWith(SESSION_PREFIX)) continue;
      const fullPath = path.join(tempDir, entry);
      const manifestPath = path.join(fullPath, 'manifest.json');
      try {
        if (fs.existsSync(manifestPath)) {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          const lastAccess = new Date(manifest.lastAccessedAt).getTime();
          if (now - lastAccess > maxAgeMs) {
            fs.rmSync(fullPath, { recursive: true, force: true });
            log.info(`Expired session: ${entry}`);
          }
        } else {
          // No manifest — orphaned directory, remove it
          const stat = fs.statSync(fullPath);
          if (now - stat.mtimeMs > maxAgeMs) {
            fs.rmSync(fullPath, { recursive: true, force: true });
            log.info(`Removed orphaned session dir: ${entry}`);
          }
        }
      } catch (e) {
        log.warn(`Error during cleanup of ${entry}:`, e.message);
      }
    }
  }
}

module.exports = EditorSession;

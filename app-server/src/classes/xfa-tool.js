'use strict';

/**
 * xfa-tool.js — XFA PDF detection and conversion helper.
 *
 * Detects whether an uploaded PDF is a dynamic XFA form and, if so,
 * converts it to a flat static PDF using the bundled xfa-convert pipeline.
 *
 * Returns the path of the flat PDF on success; the original XFA file is
 * deleted afterwards so no extra ephemeral files linger in the session
 * directory.  If the pipeline is not installed or conversion fails, null
 * is returned and the original file is left untouched.
 */

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const log = require('loglevel').getLogger('XfaTool');

const BASE_PATH = process.env.SCANSERV_BASE_PATH || './';
const CONVERT_SCRIPT = path.resolve(BASE_PATH, 'xfa-convert', 'convert.py');

/**
 * Return true if the xfa-convert pipeline is installed.
 * @returns {boolean}
 */
function isAvailable() {
  return fs.existsSync(CONVERT_SCRIPT);
}

/**
 * Stream-scan filePath for the /XFA byte sequence.
 * XFA PDFs always contain /XFA in their AcroForm dictionary.
 * Uses a sliding-window scan so large files are never loaded into memory.
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
async function isXfaPdf(filePath) {
  const NEEDLE = Buffer.from('/XFA');
  const CHUNK  = 65536;
  const OVERLAP = NEEDLE.length - 1;

  return new Promise((resolve) => {
    let tail  = Buffer.alloc(0);
    let found = false;

    const rs = fs.createReadStream(filePath, { highWaterMark: CHUNK });

    rs.on('data', (chunk) => {
      const buf = Buffer.concat([tail, chunk]);
      if (buf.indexOf(NEEDLE) >= 0) {
        found = true;
        rs.destroy();
        return;
      }
      tail = buf.slice(-OVERLAP);
    });

    rs.on('close', () => resolve(found));
    rs.on('error', ()  => resolve(false));
  });
}

/**
 * Convert an XFA PDF to a flat static PDF via the xfa-convert pipeline.
 *
 * On success:
 *   - writes the flat PDF to <dir>/<stem>-flat.pdf
 *   - deletes the original XFA file (no leftover ephemeral files)
 *   - returns the absolute path of the flat PDF
 *
 * On failure:
 *   - logs a warning
 *   - returns null (original file is left intact for the caller to handle)
 *
 * @param {string} inputPath - absolute path to the uploaded XFA PDF
 * @returns {Promise<string|null>}
 */
async function convertXfa(inputPath) {
  const dir    = path.dirname(inputPath);
  const stem   = path.basename(inputPath, path.extname(inputPath));
  const output = path.join(dir, `${stem}-flat.pdf`);

  return new Promise((resolve) => {
    execFile(
      'python3',
      [CONVERT_SCRIPT, inputPath, output],
      { timeout: 120000, cwd: path.resolve(BASE_PATH) },
      (err, _stdout, stderr) => {
        if (err) {
          log.warn(`XFA conversion failed for ${path.basename(inputPath)}: ${err.message}`);
          if (stderr) {
            log.warn(stderr.trim());
          }
          resolve(null);
          return;
        }
        // Remove the original XFA file; only the flat PDF remains.
        try {
          fs.unlinkSync(inputPath);
        } catch (_) {
          // ignore
        }
        resolve(output);
      }
    );
  });
}

module.exports = { isAvailable, isXfaPdf, convertXfa };

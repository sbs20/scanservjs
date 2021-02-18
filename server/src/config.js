const dayjs = require('dayjs');
const fs = require('fs');
const path = require('path');
const Package = require('../package.json');
let instance = null;

class Config {
  constructor() {
    this.init();
    this.addEnvironment();
    this.applyLocal();
  }

  init() {
    Object.assign(this, {
      version: Package.version,
      port: 8080,
      devices: [],
      ocrLanguage: 'eng',
      clearPreviewOnScan: false,
      log: {
        level: 'DEBUG',
        prefix: {
          template: '[%t] %l (%n):',
          levelFormatter(level) {
            return level.toUpperCase();
          },
          nameFormatter(name) {
            return name || 'global';
          },
          timestampFormatter(date) {
            return date.toISOString();
          }
        }
      },
      filename() {
        return `scan_${dayjs().format('YYYY-MM-DD HH.mm.ss')}`;
      },
    
      scanimage: '/usr/bin/scanimage',
      convert: '/usr/bin/convert',
      tesseract: '/usr/bin/tesseract',
    
      allowUnsafePaths: false,
      devicesPath: './config/devices.json',
      outputDirectory: './data/output/',
      previewDirectory: './data/preview/',
      tempDirectory: './data/temp/',
    
      previewResolution: 100,
      previewPipeline: {
        extension: 'jpg',
        description: 'JPG (Low quality)',
        commands: [
          'convert - -quality 75 jpg:-'
        ]
      },

      filters: [
        {
          description: 'Auto level',
          params: '-auto-level'
        },
        {
          description: 'Threshold',
          params: '-channel RGB -threshold 80%'
        },
        {
          description: 'Blur',
          params: '-blur 1'
        }
      ],
    
      pipelines: [
        {
          extension: 'jpg',
          description: 'JPG | High quality',
          commands: [
            'convert @- -quality 92 scan-%04d.jpg',
            'ls scan-*.*'
          ]
        },
        {
          extension: 'jpg',
          description: 'JPG | Medium quality',
          commands: [
            'convert @- -quality 75 scan-%04d.jpg',
            'ls scan-*.*'
          ]
        },
        {
          extension: 'jpg',
          description: 'JPG | Low quality',
          commands: [
            'convert @- -quality 50 scan-%04d.jpg',
            'ls scan-*.*'
          ]
        },
        {
          extension: 'png',
          description: 'PNG',
          commands: [
            'convert @- -quality 75 scan-%04d.png',
            'ls scan-*.*'
          ]
        },
        {
          extension: 'tif',
          description: 'TIF | Uncompressed',
          commands: [
            'convert @- scan-0000.tif',
            'ls scan-*.*'
          ]
        },
        {
          extension: 'tif',
          description: 'TIF | LZW compression',
          commands: [
            'convert @- -compress lzw scan-0000.tif',
            'ls scan-*.*'
          ]
        },
        {
          extension: 'pdf',
          description: 'PDF (TIF | Uncompressed)',
          commands: [
            'convert @- scan-0000.pdf',
            'ls scan-*.*'
          ]
        },
        {
          extension: 'pdf',
          description: 'PDF (TIF | LZW Compression)',
          commands: [
            'convert @- -compress lzw tmp-%04d.tif && ls tmp-*.tif',
            'convert @- scan-0000.pdf',
            'ls scan-*.*'
          ]
        },
        {
          extension: 'pdf',
          description: 'PDF (JPG | High quality)',
          commands: [
            'convert @- -quality 92 tmp-%04d.jpg && ls tmp-*.jpg',
            'convert @- scan-0000.pdf',
            'ls scan-*.*'
          ]
        },
        {
          extension: 'pdf',
          description: 'PDF (JPG | Medium quality)',
          commands: [
            'convert @- -quality 75 tmp-%04d.jpg && ls tmp-*.jpg',
            'convert @- scan-0000.pdf',
            'ls scan-*.*'
          ]
        },
        {
          extension: 'pdf',
          description: 'PDF (JPG | Low quality)',
          commands: [
            'convert @- -quality 50 tmp-%04d.jpg && ls tmp-*.jpg',
            'convert @- scan-0000.pdf',
            'ls scan-*.*'
          ]
        }
      ]
    });

    this.pipelines = this.pipelines.concat([
      {
        extension: 'pdf',
        description: 'OCR | PDF (JPG | High quality)',
        commands: [
          'convert @- -quality 92 tmp-%d.jpg && ls tmp-*.jpg',
          `${this.tesseract} -l ${this.ocrLanguage} -c stream_filelist=true - - pdf > scan-0001.pdf`,
          'ls scan-*.*'
        ]
      },
      {
        extension: 'txt',
        description: 'OCR | Text file',
        commands: [
          `${this.tesseract} -l ${this.ocrLanguage} -c stream_filelist=true - - txt > scan-0001.txt`,
          'ls scan-*.*'
        ]
      }
    ]);
  }

  addEnvironment() {
    // Process environment variables

    // It's possible that device strings contain semi colons, which is the default
    // delimiter. This environment variable enables overriding
    let DELIMITER = ';';
    if (process.env.DELIMITER !== undefined && process.env.DELIMITER.length > 0) {
      DELIMITER = process.env.DELIMITER;
    }

    // scanservjs will attempt to find scanners locally using `scanimage -L` but
    // sometimes you may need to manually add network devices here if they're not
    // found e.g.
    // Config.devices = ['net:192.168.0.10:airscan:e0:Canon TR8500 series'];
    // This is done with an environment variable. Multiple entries are separated by
    // semicolons or $DELIMITER
    if (process.env.DEVICES !== undefined && process.env.DEVICES.length > 0) {
      this.devices = process.env.DEVICES.split(DELIMITER);
    }

    // scanservjs will attempt to find scanners locally using `scanimage -L` but
    // sometimes it will return nothing. If you are specifying devices manually you
    // may also with to turn off the find.
    this.devicesFind = process.env.SCANIMAGE_LIST_IGNORE === undefined
      || process.env.SCANIMAGE_LIST_IGNORE.length === 0;

    // Override the OCR language here
    if (process.env.OCR_LANG !== undefined && process.env.OCR_LANG.length > 0) {
      this.ocrLanguage = process.env.OCR_LANG;
    }
  }

  applyLocal() {
    // Apply user config
    const localPath = path.join(__dirname, '../config/config.local.js');
    if (fs.existsSync(localPath)) {
      const localConfig = require(localPath);
      localConfig.afterConfig(this);
    }
  }

  /**
   * @returns {Configuration}
   */
  static instance() {
    if (instance === null) {
      instance = new Config();
    }
    return instance;
  }
}

module.exports = Config.instance();

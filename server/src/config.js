const dayjs = require('dayjs');
const userOptions = require('./user-options');
const Package = require('../package.json');
let instance = null;

class Config {
  constructor() {
    this.init();
    this.addEnvironment();
    userOptions.applyToConfig(this);
  }

  init() {
    Object.assign(this, {
      version: Package.version,
      port: 8080,
      devices: [],
      ocrLanguage: 'eng',
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
          description: 'filter.auto-level',
          params: '-auto-level'
        },
        {
          description: 'filter.threshold',
          params: '-channel RGB -threshold 80%'
        },
        {
          description: 'filter.blur',
          params: '-blur 1'
        }
      ],
    
      paperSizes: [
        { name: 'A3', dimensions: { x: 297, y: 420 } },
        { name: 'A4', dimensions: { x: 215, y: 297 } },
        { name: 'A5', dimensions: { x: 148, y: 215 } },
        { name: 'A6', dimensions: { x: 105, y: 148 } },
        { name: 'B3', dimensions: { x: 353, y: 500 } },
        { name: 'B4', dimensions: { x: 250, y: 353 } },
        { name: 'B5', dimensions: { x: 176, y: 250 } },
        { name: 'B6', dimensions: { x: 125, y: 176 } },
        { name: 'DIN D3', dimensions: { x: 272, y: 385 } },
        { name: 'DIN D4', dimensions: { x: 192, y: 272 } },
        { name: 'DIN D5', dimensions: { x: 136, y: 192 } },
        { name: 'DIN D6', dimensions: { x: 96, y: 136 } },
        { name: 'Letter', dimensions: { x: 216, y: 279 } },
        { name: 'Legal', dimensions: { x: 216, y: 356 } },
        { name: 'Tabloid', dimensions: { x: 279, y: 432 } },
        { name: 'Ledger', dimensions: { x: 432, y: 279 } },
        { name: 'Junior legal', dimensions: { x: 127, y: 203 } },
        { name: 'Half letter', dimensions: { x: 140, y: 216 } }
      ],

      pipelines: [
        {
          extension: 'jpg',
          description: 'JPG | @:pipeline.high-quality',
          commands: [
            'convert @- -quality 92 scan-%04d.jpg',
            'ls scan-*.*'
          ]
        },
        {
          extension: 'jpg',
          description: 'JPG | @:pipeline.medium-quality',
          commands: [
            'convert @- -quality 75 scan-%04d.jpg',
            'ls scan-*.*'
          ]
        },
        {
          extension: 'jpg',
          description: 'JPG | @:pipeline.low-quality',
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
          description: 'TIF | @:pipeline.uncompressed',
          commands: [
            'convert @- scan-0000.tif',
            'ls scan-*.*'
          ]
        },
        {
          extension: 'tif',
          description: 'TIF | @:pipeline.lzw-compressed',
          commands: [
            'convert @- -compress lzw scan-0000.tif',
            'ls scan-*.*'
          ]
        },
        {
          extension: 'pdf',
          description: 'PDF (TIF | @:pipeline.uncompressed)',
          commands: [
            'convert @- scan-0000.pdf',
            'ls scan-*.*'
          ]
        },
        {
          extension: 'pdf',
          description: 'PDF (TIF | @:pipeline.lzw-compressed)',
          commands: [
            'convert @- -compress lzw tmp-%04d.tif && ls tmp-*.tif',
            'convert @- scan-0000.pdf',
            'ls scan-*.*'
          ]
        },
        {
          extension: 'pdf',
          description: 'PDF (JPG | @:pipeline.high-quality)',
          commands: [
            'convert @- -quality 92 tmp-%04d.jpg && ls tmp-*.jpg',
            'convert @- scan-0000.pdf',
            'ls scan-*.*'
          ]
        },
        {
          extension: 'pdf',
          description: 'PDF (JPG | @:pipeline.medium-quality)',
          commands: [
            'convert @- -quality 75 tmp-%04d.jpg && ls tmp-*.jpg',
            'convert @- scan-0000.pdf',
            'ls scan-*.*'
          ]
        },
        {
          extension: 'pdf',
          description: 'PDF (JPG | @:pipeline.low-quality)',
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
        description: '@:pipeline.ocr | PDF (JPG | @:pipeline.high-quality)',
        commands: [
          'convert @- -quality 92 tmp-%d.jpg && ls tmp-*.jpg',
          `${this.tesseract} -l ${this.ocrLanguage} -c stream_filelist=true - - pdf > scan-0001.pdf`,
          'ls scan-*.*'
        ]
      },
      {
        extension: 'txt',
        description: '@:pipeline.ocr | @:pipeline.text-file',
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

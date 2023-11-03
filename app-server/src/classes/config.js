const dayjs = require('dayjs');
const path = require('path');
const Constants = require('../constants');
const Package = require('../../package.json');

const BASE_PATH = process.env.SCANSERV_BASE_PATH || './';

module.exports = class Config {
  /**
   * Constructor
   * @param {UserOptions} userOptions
   */
  constructor(userOptions) {
    this.init();
    this.addEnvironment();
    userOptions.afterConfig(this);
  }

  init() {
    Object.assign(this, {
      applicationName: Package.name,
      applicationDescription: Package.description,
      version: Package.version,
      port: 8080,
      host: '::',
      timeout: 600000,
      devices: [],
      ocrLanguage: 'eng',
      log: {
        level: 'INFO',
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

      devicesPath: path.join(BASE_PATH, 'data/devices.json'),
      outputDirectory: path.join(BASE_PATH, 'data/output'),
      thumbnailDirectory: path.join(BASE_PATH, 'data/thumbnail'),
      previewDirectory: path.join(BASE_PATH, 'data/preview'),
      tempDirectory: path.join(BASE_PATH, 'data/temp'),

      users: {},

      previewResolution: 100,
      previewPipeline: {
        extension: 'jpg',
        description: 'JPG (Low quality)',
        commands: [
          'convert - -quality 75 jpg:-'
        ]
      },

      batchModes: [
        Constants.BATCH_NONE,
        Constants.BATCH_MANUAL,
        Constants.BATCH_AUTO,
        Constants.BATCH_COLLATE_STANDARD
      ],

      filters: [
        {
          description: 'filter.auto-contrast',
          params: '-equalize'
        },
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
        },
        {
          description: 'filter.more-contrast',
          params: '+contrast +contrast +contrast'
        }
      ],

      paperSizes: [
        { name: 'A3 (@:paper-size.portrait)', dimensions: { x: 297, y: 420 } },
        { name: 'A4 (@:paper-size.portrait)', dimensions: { x: 210, y: 297 } },
        { name: 'A5 (@:paper-size.portrait)', dimensions: { x: 148, y: 210 } },
        { name: 'A5 (@:paper-size.landscape)', dimensions: { x: 210, y: 148 } },
        { name: 'A6 (@:paper-size.portrait)', dimensions: { x: 105, y: 148 } },
        { name: 'A6 (@:paper-size.landscape)', dimensions: { x: 148, y: 105 } },
        { name: 'B3 (@:paper-size.portrait)', dimensions: { x: 353, y: 500 } },
        { name: 'B4 (@:paper-size.portrait)', dimensions: { x: 250, y: 353 } },
        { name: 'B5 (@:paper-size.portrait)', dimensions: { x: 176, y: 250 } },
        { name: 'B5 (@:paper-size.landscape)', dimensions: { x: 250, y: 176 } },
        { name: 'B6 (@:paper-size.portrait)', dimensions: { x: 125, y: 176 } },
        { name: 'B6 (@:paper-size.landscape)', dimensions: { x: 176, y: 125 } },
        { name: 'DIN D3 (@:paper-size.portrait)', dimensions: { x: 272, y: 385 } },
        { name: 'DIN D4 (@:paper-size.portrait)', dimensions: { x: 192, y: 272 } },
        { name: 'DIN D5 (@:paper-size.portrait)', dimensions: { x: 136, y: 192 } },
        { name: 'DIN D5 (@:paper-size.landscape)', dimensions: { x: 192, y: 136 } },
        { name: 'DIN D6 (@:paper-size.portrait)', dimensions: { x: 96, y: 136 } },
        { name: 'DIN D6 (@:paper-size.landscape)', dimensions: { x: 136, y: 96 } },
        { name: '@:paper-size.letter (@:paper-size.portrait)', dimensions: { x: 216, y: 279 } },
        { name: '@:paper-size.legal (@:paper-size.portrait)', dimensions: { x: 216, y: 356 } },
        { name: '@:paper-size.tabloid (@:paper-size.portrait)', dimensions: { x: 279, y: 432 } },
        { name: '@:paper-size.ledger (@:paper-size.portrait)', dimensions: { x: 432, y: 279 } },
        { name: '@:paper-size.junior-legal (@:paper-size.portrait)', dimensions: { x: 127, y: 203 } },
        { name: '@:paper-size.half-letter (@:paper-size.portrait)', dimensions: { x: 140, y: 216 } }
      ],
    });

    const config = this;
    this.pipelines = [
      {
        extension: 'jpg',
        description: 'JPG | @:pipeline.high-quality',
        commands: [
          'while read filename ; do convert -quality 92 $filename scan-$(date +%s.%N).jpg ; done',
          'ls scan-*.*'
        ]
      },
      {
        extension: 'jpg',
        description: 'JPG | @:pipeline.medium-quality',
        commands: [
          'while read filename ; do convert -quality 75 $filename scan-$(date +%s.%N).jpg ; done',
          'ls scan-*.*'
        ]
      },
      {
        extension: 'jpg',
        description: 'JPG | @:pipeline.low-quality',
        commands: [
          'while read filename ; do convert -quality 50 $filename scan-$(date +%s.%N).jpg ; done',
          'ls scan-*.*'
        ]
      },
      {
        extension: 'png',
        description: 'PNG',
        commands: [
          'while read filename ; do convert -quality 75 $filename scan-$(date +%s.%N).png ; done',
          'ls scan-*.*'
        ]
      },
      {
        extension: 'tif',
        description: 'TIF | @:pipeline.uncompressed',
        commands: [
          'while read filename ; do convert $filename scan-$(date +%s.%N).tif ; done',
          'ls scan-*.*'
        ]
      },
      {
        extension: 'tif',
        description: 'TIF | @:pipeline.lzw-compressed',
        commands: [
          'while read filename ; do convert -compress lzw $filename scan-$(date +%s.%N).tif ; done',
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
          'while read filename ; do convert -compress lzw $filename converted-$(date +%s.%N).tif ; done && ls converted-*.tif',
          'convert @- scan-0000.pdf',
          'ls scan-*.*'
        ]
      },
      {
        extension: 'pdf',
        description: 'PDF (JPG | @:pipeline.high-quality)',
        commands: [
          'while read filename ; do convert -quality 92 $filename converted-$(date +%s.%N).jpg ; done && ls converted-*.jpg',
          'convert @- scan-0000.pdf',
          'ls scan-*.*'
        ]
      },
      {
        extension: 'pdf',
        description: 'PDF (JPG | @:pipeline.medium-quality)',
        commands: [
          'while read filename ; do convert -quality 75 $filename converted-$(date +%s.%N).jpg ; done && ls converted-*.jpg',
          'convert @- scan-0000.pdf',
          'ls scan-*.*'
        ]
      },
      {
        extension: 'pdf',
        description: 'PDF (JPG | @:pipeline.low-quality)',
        commands: [
          'while read filename ; do convert -quality 50 $filename converted-$(date +%s.%N).jpg ; done && ls converted-*.jpg',
          'convert @- scan-0000.pdf',
          'ls scan-*.*'
        ]
      },
      {
        extension: 'pdf',
        description: '@:pipeline.ocr | PDF (JPG | @:pipeline.high-quality)',
        get commands() {
          return [
            'while read filename ; do convert -quality 92 $filename converted-$(date +%s.%N).jpg ; done && ls converted-*.jpg',
            `${config.tesseract} -l ${config.ocrLanguage} -c stream_filelist=true - - pdf > scan-0001.pdf`,
            'ls scan-*.*'
          ];
        }
      },
      {
        extension: 'txt',
        description: '@:pipeline.ocr | @:pipeline.text-file',
        get commands() {
          return [
            `${config.tesseract} -l ${config.ocrLanguage} -c stream_filelist=true - - txt > scan-0001.txt`,
            'ls scan-*.*'
          ];
        }
      }
    ];
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
};

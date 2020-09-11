const dateFormat = require('dateformat');

const Config = {
  port: 8080,
  scanimage: '/usr/bin/scanimage',
  convert: '/usr/bin/convert',
  outputDirectory: './data/output/',
  previewDirectory: './data/preview/',
  previewResolution: 100,
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
      },
    }
  },
  filename() {
    return `scan_${dateFormat(new Date(), 'yyyy-mm-dd HH.MM.ss')}`;
  },
  previewPipeline: {
    extension: 'jpg',
    description: 'JPG (Low Quality)',
    commands: [
      'convert - -quality 75 jpg:-'
    ]
  },
  pipelines: [
    {
      extension: 'tif',
      description: 'TIF (uncompressed)',
      commands: []
    },
    {
      extension: 'tif',
      description: 'TIF (LZW)',
      commands: [
        'convert - -compress lzw tif:-'
      ]
    },
    {
      extension: 'jpg',
      description: 'JPG (High Quality)',
      commands: [
        'convert - -quality 92 jpg:-'
      ]
    },
    {
      extension: 'jpg',
      description: 'JPG (Medium Quality)',
      commands: [
        'convert - -quality 75 jpg:-'
      ]
    },
    {
      extension: 'jpg',
      description: 'JPG (Low Quality)',
      commands: [
        'convert - -quality 50 jpg:-'
      ]
    },
    {
      extension: 'png',
      description: 'PNG',
      commands: [
        'convert - -quality 75 png:-'
      ]
    },
    {
      extension: 'pdf',
      description: 'PDF (Full TIF)',
      commands: [
        'convert - pdf:-'
      ]
    },
    {
      extension: 'pdf',
      description: 'PDF (Full TIF)',
      commands: [
        'convert - -compress lzw tif:-',
        'convert - pdf:-'
      ]
    },
    {
      extension: 'pdf',
      description: 'PDF (With JPG compression)',
      commands: [
        'convert - -quality 92 jpg:-',
        'convert - pdf:-'
      ]
    }
  ]
};

module.exports = Config;

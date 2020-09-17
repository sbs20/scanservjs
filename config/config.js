const dayjs = require('dayjs');

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
    return `scan_${dayjs().format('YYYY-MM-DD HH.mm.ss')}`;
  },
  previewPipeline: {
    extension: 'jpg',
    description: 'JPG (Low quality)',
    commands: [
      'convert - -quality 75 jpg:-'
    ]
  },
  pipelines: [
    {
      extension: 'jpg',
      description: 'JPG (High quality)',
      commands: [
        'convert - -quality 92 jpg:-'
      ]
    },
    {
      extension: 'jpg',
      description: 'JPG (Medium quality)',
      commands: [
        'convert - -quality 75 jpg:-'
      ]
    },
    {
      extension: 'jpg',
      description: 'JPG (Low quality)',
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
      extension: 'tif',
      description: 'TIF (Uncompressed)',
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
      extension: 'pdf',
      description: 'PDF (TIF)',
      commands: [
        'convert - pdf:-'
      ]
    },
    {
      extension: 'pdf',
      description: 'PDF (LZW TIF)',
      commands: [
        'convert - -compress lzw tif:-',
        'convert - pdf:-'
      ]
    },
    {
      extension: 'pdf',
      description: 'PDF (JPG)',
      commands: [
        'convert - -quality 92 jpg:-',
        'convert - pdf:-'
      ]
    }
  ]
};

module.exports = Config;

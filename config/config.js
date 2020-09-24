const dayjs = require('dayjs');

const Config = {};

// Things to change
Config.port = 8080;

// scanservjs will attempt to find scanners locally using `scanimage -L` but you
// will need to manually add network devices here which will be appended. e.g.
// Config.devices = ['net:192.168.0.10:airscan:e0:Canon TR8500 series'];
Config.devices = [];
Config.ocrLanguage = 'eng';
Config.log = {};
Config.log.level = 'DEBUG';
Config.filename = () => {
  return `scan_${dayjs().format('YYYY-MM-DD HH.mm.ss')}`;
};

// Probably do not change
Config.scanimage = '/usr/bin/scanimage';
Config.convert = '/usr/bin/convert';
Config.tesseract = '/usr/bin/tesseract';
Config.log.prefix = {
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
};

// No need to change
Config.outputDirectory = './data/output/';
Config.previewDirectory = './data/preview/';
Config.tempDirectory = './data/temp/';
Config.previewResolution = 100;
Config.previewPipeline = {
  extension: 'jpg',
  description: 'JPG (Low quality)',
  commands: [
    'convert - -quality 75 jpg:-'
  ]
};

/*
When all scans are complete, the filenames are all piped into stdin to the
pipeline commands. It would be nicer to pipe the binary output of scanimage but
that doesn't work with multipage scans so we have no choice but to write to the
filesystem.

The stdout of each pipeline feeds into the stdin of the next. Although clumsy in
some respects (especially where we have to write temporary files and then list
them) it at least provides a means of user configuration with "just" shell
scripting.

Each command is executed with the CWD set to the temporary location so no
directory traversal is required. Pipeline commands are always read from this
file (and never from the browser request, even though it is sent). It would be
possible to subvert these commands for malicious use, but it doesn't give any
further privilege than the user account running scanservjs. You obviously should
not be running as root.

Some useful pointers:
- `convert` can read a list of files from a file with the @ argument. The `-`
  file is stdin. So `convert @- -argument output` performs the conversion om
  each file piped into stdin
- `tesseract` has a similar feature using `-c stream_filelist=true`
- if you just wanted to take a filename from stdin and have its content read out
  you could `xargs cat` provided there were no spaces or commas in the filename
  (which there won't be)
*/
Config.pipelines = [
  {
    extension: 'jpg',
    description: 'JPG (High quality)',
    commands: [
      'convert @- -quality 92 jpg:-'
    ]
  },
  {
    extension: 'jpg',
    description: 'JPG (Medium quality)',
    commands: [
      'convert @- -quality 75 jpg:-'
    ]
  },
  {
    extension: 'jpg',
    description: 'JPG (Low quality)',
    commands: [
      'convert @- -quality 50 jpg:-'
    ]
  },
  {
    extension: 'png',
    description: 'PNG',
    commands: [
      'convert @- -quality 75 png:-'
    ]
  },
  {
    extension: 'tif',
    description: 'TIF (Uncompressed)',
    commands: [
      'convert @- tif:-'
    ]
  },
  {
    extension: 'tif',
    description: 'TIF (LZW)',
    commands: [
      'convert @- -compress lzw tif:-'
    ]
  },
  {
    extension: 'pdf',
    description: 'PDF (TIF)',
    commands: [
      'convert @- pdf:-'
    ]
  },
  {
    extension: 'pdf',
    description: 'PDF (LZW TIF)',
    commands: [
      'convert @- -compress lzw tmp-%d.tif && ls tmp-*.tif',
      'convert @- pdf:-'
    ]
  },
  {
    extension: 'pdf',
    description: 'PDF (JPG)',
    commands: [
      'convert @- -quality 92 tmp-%d.jpg && ls tmp-*.jpg',
      'convert @- pdf:-'
    ]
  }
];

if (Config.tesseract) {
  Config.pipelines = Config.pipelines.concat([
    {
      extension: 'pdf',
      description: 'PDF (JPG) with OCR text',
      commands: [
        'convert @- -quality 92 tmp-%d.jpg && ls tmp-*.jpg',
        `${Config.tesseract} -l ${Config.ocrLanguage} -c stream_filelist=true - - pdf && rm -f tmp-*.jpg`
      ]
    },
    {
      extension: 'txt',
      description: 'Text file (OCR)',
      commands: [
        `${Config.tesseract} -l ${Config.ocrLanguage} -c stream_filelist=true - - txt && rm -f tmp-*.tif`
      ]
    }
  ]);
}

module.exports = Config;

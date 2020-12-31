const dayjs = require('dayjs');

const Config = {};

// Things to change
Config.port = 8080;
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

/* When all scans are complete, the filenames are all piped into stdin of the
first pipeline command. It would be nicer to pipe the binary output of scanimage
but that doesn't work with multipage scans so we have no choice but to write to
the filesystem.

The stdout of each pipeline feeds into the stdin of the next. Although clumsy in
some respects (especially where we have to write temporary files and then list
them) it at least provides a means of user configuration with "just" shell
scripting.

The overall output of the pipelines (i.e. the last pipeline output) must be a
list of the files you want kept. The convention is to output files of the form
`scan-0000.ext` but it's convention only. You can output whatever you want. If
multiple files are output then the results will be zipped into a single file.

Each command is executed with the CWD set to the temporary location so no
directory traversal is required. Pipeline commands are always read from this
file (and never from the browser request, even though it is sent). It would be
possible to subvert these commands for malicious use, but it doesn't give any
further privilege than the user account running scanservjs and still requires
access to this file. You obviously should not be running as root.

Some useful pointers:
- `convert` can read a list of files from a file with the @ argument. The `-`
  file is stdin. So `convert @- -argument output` performs the conversion on
  each file piped into stdin
- `tesseract` has a similar feature using `-c stream_filelist=true`
- `convert` can also output multiple files if you use an output filename with
  `%d` in it. C string style formatting is available so you can do things like
  output to `scan-%04d.jpg`. Formats which do not support multiple pages must
  use this option. Multi-page formats including PDF and TIF do not use this
  option.
- if you just wanted to take a filename from stdin and have its content read out
  you could `xargs cat` provided there were no spaces or commas in the filename
  (which there won't be)
*/
Config.pipelines = [
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
];

if (Config.tesseract) {
  Config.pipelines = Config.pipelines.concat([
    {
      extension: 'pdf',
      description: 'OCR | PDF (JPG | High quality)',
      commands: [
        'convert @- -quality 92 tmp-%d.jpg && ls tmp-*.jpg',
        `${Config.tesseract} -l ${Config.ocrLanguage} -c stream_filelist=true - - pdf > scan-0001.pdf`,
        'ls scan-*.*'
      ]
    },
    {
      extension: 'txt',
      description: 'OCR | Text file',
      commands: [
        `${Config.tesseract} -l ${Config.ocrLanguage} -c stream_filelist=true - - txt > scan-0001.txt`,
        'ls scan-*.*'
      ]
    }
  ]);
}

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
  Config.devices = process.env.DEVICES.split(DELIMITER);
}

// scanservjs will attempt to find scanners locally using `scanimage -L` but
// sometimes it will return nothing. If you are specifying devices manually you
// may also with to turn off the find.
Config.devicesFind = process.env.SCANIMAGE_LIST_IGNORE === undefined
  || process.env.SCANIMAGE_LIST_IGNORE.length === 0;

// Override the OCR language here
if (process.env.OCR_LANG !== undefined && process.env.OCR_LANG.length > 0) {
  Config.ocrLanguage = process.env.OCR_LANG;
}

module.exports = Config;

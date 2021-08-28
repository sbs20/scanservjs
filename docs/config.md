# Configuration overrides

Sometimes scanners don't return quite what you want them to. Likewise, perhaps
scanservjs doesn't provide the defaults you want. Furtunately it's possible to
override most things you might want to.

The two things you can modify are:
* `config`: These are the global settings which include things like:
  * Server port
  * Log level
  * Preview resolution
  * Output filename
  * Pipelines (output format)
* `devices`: The device definitions which are reported by SANE which include
  scanner dimensions and geometry, modes, resolutions and sources.

TL;DR; copy `./config/config.default.js` to `config/config.local.js`, override
the sections you want and then restart the app
`sudo systemctl restart scanservjs.service`

If you are using docker, then you will want to map the configuration directory
e.g. `-v /my/local/path:/app/config`.

## How it works

scanservjs looks for a file called `config/config.local.js` and attempts to call
two functions at different stages in the processing:
* `afterConfig(config)`: whenever a config is read, the result is passed to this
  function before being either used or sent down to the browser.
* `afterDevices(devices)`: whenever the devices are read, the result is passed
  to this function before being used.
* See [example source](../packages/server/config/config.default.js) for more
  options.
* Please note that the config file only gets read at start-up - so if you make
  changes, you will need to restart.

## Example file

```javascript
module.exports = {
  /**
   * @param {Configuration} config 
   */
  afterConfig(config) {
    // Set default preview resolution
    config.previewResolution = 150;

    // Add a custom print pipeline
    config.pipelines.push({
      extension: 'pdf',
      description: 'Print PDF',
      commands: [
        'convert @- -quality 92 tmp-%04d.jpg && ls tmp-*.jpg',
        'convert @- scan-0000.pdf',
        'lp -d MY_PRINTER scan-0000.pdf',
        'ls scan-*.*'
      ]
    });
  },

  /**
   * @param {ScanDevice[]} devices 
   */
  afterDevices(devices) {
    // Override the defaults for plustek scanners
    devices
      .filter(d => d.id.includes('plustek'))
      .forEach(device => {
        device.features['--mode'].default = 'Color';
        device.features['--resolution'].default = 150;
        device.features['--resolution'].options = [75, 150, 300, 600];
        device.features['--brightness'].default = 0;
        device.features['--contrast'].default = 5;
        device.features['-x'].default = 215;
        device.features['-y'].default = 297;  
      });
  }
};
```

## Recipes

### Override default width, height and resolution

You have an old Canon flatbed but it returns daft default values for width and
height. You also want to change the default resolution and limit the resolution
options.

```javascript
  /**
   * @param {ScanDevice[]} devices 
   */
  afterDevices(devices) {
    // Override the defaults for plustek scanners
    devices
      .filter(d => d.id.includes('plustek'))
      .forEach(device => {
        device.features['--resolution'].default = 150;
        device.features['--resolution'].options = [75, 150, 300, 600];
        device.features['-x'].default = 215;
        device.features['-y'].default = 297;
      });
  }
```

### Override scanner dimensions

Some scanners (I'm looking at you, Brother) report their dimensions
[incorrectly](https://github.com/sbs20/scanservjs/issues/103). This throws off
the cropping logic because scanservjs incorrectly trusts the SANE output.

```javascript
  afterDevices(devices) {
    devices
      .filter(d => d.id.includes('brother'))
      .forEach(device => {
        device.features['-l'].limits = [0, 215];
        device.features['-t'].limits = [0, 297];
        device.features['-x'].default = 215;
        device.features['-x'].limits = [0, 215];
        device.features['-y'].default = 297;
        device.features['-y'].limits = [0, 297];
      });
  }
```

### Friendly device name

If you have many scanners available then you may wish to give devices friendly
names as per [#212](https://github.com/sbs20/scanservjs/issues/212).
`{ScanDevice}` objects have a `name` attribute which defaults to the `id` but
can be anything you want it to be. You just need to override it.

```javascript
  afterDevices(devices) {
    const deviceNames = {
      'plustek:libusb:001:003': 'Downstairs Canon Flatbed',
      'test:device:unreal': 'Upstairs Canon MFD'
    };

    devices
      .filter(d => d.id in deviceNames)
      .forEach(d => d.name = deviceNames[d.id]);
  }
```

### Insert your own pipelines

You may wish to add your own custom pipelines. Pipelines are arrays of shell
commands which run after scans. To learn more read the
[example source](../packages/server/config/config.default.js). This will insert
your own pipelines at the top of the list.

```javascript
  afterConfig(config) {
    const pipelines = [
      {
        extension: 'jpg',
        description: 'TEST PIPELINE | Terrible quality',
        commands: [
          'convert @- -quality 20 scan-%04d.jpg',
          'ls scan-*.*'
        ]
      },
      {
        extension: 'jpg',
        description: 'TEST PIPELINE 2 | Silly quality',
        commands: [
          'convert @- -quality 99 scan-%04d.jpg',
          'ls scan-*.*'
        ]
      }
    ];

    config.pipelines.splice(0, 0, ...pipelines);
  },
```

#### Pipeline using "ocrmypdf"
[ocrmypdf](https://github.com/jbarlow83/OCRmyPDF) is a tool which deskews
crooked scans, automatically fixes incorrectly rotated pages and performs OCR
with tesseract. It needs to be installed separately, see the
[official instructions](https://ocrmypdf.readthedocs.io/en/latest/installation.html).

Then, add the following pipeline:
```javascript
  config.pipelines.push({
    extension: 'pdf',
    description: 'ocrmypdf (JPG | @:pipeline.high-quality)',
    get commands() {
      return [
        'convert @- -quality 92 tmp-%04d.jpg && ls tmp-*.jpg',
        'convert @- pdf:-',
        `ocrmypdf -l ${config.ocrLanguage} --deskew --rotate-pages - scan_0000.pdf`,
        'ls scan_*.*'
      ];
    }
  });
```

### Change the log level and default scan filename

```javascript
const dayjs = require('dayjs');
module.exports = {
  afterConfig(config) {
    config.filename = () => {
      return `my_filestem_${dayjs().format('DD-MM-YYYY HH-mm-ss')}`;
    };

    config.log.level = 'DEBUG';
  }
}
```

### Change default output directory

Exercise caution with this recipe - the app is designed not to allow unsafe
paths by default. If you are happy to disable this check, then go ahead.

```javascript
module.exports = {
  afterConfig(config) {
    // Set your path here
    config.outputDirectory = '/home/me/scanned';

    // By default paths with `..` or `/` are not allowed
    config.allowUnsafePaths = true;
  }
}
```

### Only show ISO paper sizes

You can use a filter to include only the paper sizes you want. To only show ISO
sizes do something like the following. You can obviously extend or reverse the
filter as required.

```javascript
module.exports = {
  afterConfig(config) {
    config.paperSizes = config.paperSizes.filter(p => /[AB]\d/.test(p.name));
  }
}
```
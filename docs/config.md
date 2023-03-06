# Configuration and integration

Sometimes scanners don't return quite what you want them to. Likewise, perhaps
scanservjs doesn't provide the defaults you want. And maybe you want to do your
own thing after a scan. Furtunately it's possible to override most things you
might want to.

There are various hooks where you can customise behaviour:
* `afterConfig`: This provides a reference to the config where you can apply
  your own changes to global settings which include things like:
  * Server port
  * Log level
  * Preview resolution
  * Output filename
  * Pipelines (output format)
* `afterDevices`: You can alter the device definitions which are reported by
  SANE which include scanner dimensions and geometry, modes, resolutions and
  sources.
* `afterScan`: You receive a reference to the file which has just been scanned;
  copy it somewhere, call a script or write some code.
* `actions`: You can define custom actions which can be applied to files either
  in the UI or referenced in a pipeline. An action object must have a name and
  async execute method taking a `FileInfo`:
  ```javascript
  {
    name: 'Copy file to home directory',
    async execute(fileInfo) {
      await Process.spawn(`cp '${fileInfo.fullname}' ~/`);
    }
  }
  ```

TL;DR; copy `./config/config.default.js` to `config/config.local.js`, override
the sections you want and then restart the app
`sudo systemctl restart scanservjs.service`

If you are using docker, then you will want to map the configuration directory
e.g. `-v /my/local/path:/app/config`.

## How it works

scanservjs looks for a file called `config/config.local.js` and attempts to call
three functions at different stages in the processing:
* `afterConfig(config)`: whenever a config is read, the result is passed to this
  function before being either used or sent down to the browser.
* `afterDevices(devices)`: whenever the devices are read, the result is passed
  to this function before being used.
* `afterScan(fileInfo)`: whenever any scan completes, the resultant file is
  passed to this function.
* `actions`: Either at the end of a specific pipeline or on user request. If it
  runs at the end of the scan, then it's just prior to the `afterScan` event.
* See [example source](../packages/server/config/config.default.js) for more
  options.
* Please note that the config file only gets read at start-up - so if you make
  changes, you will need to restart.

## Example file

```javascript
const Process = require('../server/classes/process');

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
        device.settings.batchMode.options = ['none'];
      });
  }

  /**
   * @param {FileInfo} fileInfo 
   * @returns {Promise.<Buffer>}
   */
  async afterScan(fileInfo) {
    // Copy the scan to my home directory
    return await Process.spawn(`cp '${fileInfo.fullname}' ~/`);
  }

  /**
   * @type {Action[]}
   */
  actions: [
    {
      name: 'Echo',
      /**
       * @param {FileInfo} fileInfo
       * @returns {Promise.<any>}
       */
      async execute(fileInfo) {
        // Output the filepath (relative to the present working direectory)
        return await Process.spawn(`echo '${fileInfo.fullname}'`);
      }
    }
  ]
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
commands which run after scans.

The pipeline commands will be started subsequently but in separate subprocesses.
Therefore, e.g., the definition of variables in one line, can't be accessed in
another. If you want full scripting capabilities, create a script externally
(e.g. in /usr/local/bin), make it executable, and start it here. The script will
be executed from the tmp-folder of scanservjs, thus, it can access all temporary
files. Alternatively, a script can also request parameters, which can be set
here.

The first command of the pipeline will receive, in its standard input, the
newline-separated list of files that have been processed (one file per page).
Their order may differ from the alphabetical and numeric order, but it is
important to use the file order given, because the collation feature may have
re-ordered them (e.g. in case the user scanned every odd, then every even page).

You are free to create whatever kind of files you want, however, the last
command of the pipeline needs to return a list of files, which can be further
processed by scanservjs to create the final result within scanservjs.

To learn more read the
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

### Handling `--page-width` and `--page-height`

Some scanners need
[additional arguments](https://github.com/sbs20/scanservjs/issues/401) for
scanimage to behave. By default, the application _should_ just work. While the
end user is not presented with an option to change these in the UI, the
parameters will be automatically defaulted according to the values presented by
SANE - and will do so **per device**. Should the values not be to your liking
then you can override them as per any other device setting:

```javascript
module.exports = {
  afterDevices(devices) {
    devices
      .filter(d => d.id.includes('fujitsu'))
      .forEach(device => {
        device.features['--page-height'] = {
          default: 297,
          limits:  [0, 297]
        };
        device.features['--page-width'] = {
          default: 215,
          limits:  [0, 215]
        };
      });
}
```

### Override batchMode, filters and pipelines

Devices also have their own batch modes, filters and pipelines. By default, each
device inherits the settings in `config`.

```javascript
device.settings = {
  batchMode: {
    options: config.batchModes,
    default: config.batchModes[0]
  },
  filters: {
    options: config.filters.map(f => f.description),
    default: []
  },
  pipeline: {
    options: config.pipelines.map(p => p.description),
    default: config.pipelines[0].description
  }
};
```

But it's possible to override these settings to limit the options available to a
specific device or change the default. So just as with other device overrides:

```javascript
  /**
   * @param {ScanDevice[]} devices 
   */
  afterDevices(devices) {
    // Override the defaults for plustek scanners
    devices
      .filter(d => d.id.includes('plustek'))
      .forEach(device => {
        device.settings.batchMode.options = ['none'];
        device.settings.batchMode.default = 'none';
        device.settings.filters.default = ['filter.threshold'];
      });
  }
```

### Add actions and call after a specific pipeline

Create a file action to do wwhatever you like - this might be useful for
integrating with paperless-ng. The example below defines a pipeline which
creates a PDF and then copies it to the home directory on completion.

```javascript
const Process = require('../src/classes/process');

module.exports = {
  /**
   * @param {Configuration} config 
   */
  afterConfig(config) {
    // Add a custom copy pipeline
    config.pipelines.push({
      extension: 'pdf',
      description: 'PDF to home directory',
      commands: [
        'convert @- -quality 92 tmp-%04d.jpg && ls tmp-*.jpg',
        'convert @- scan-0000.pdf',
        'ls scan-*.*'
      ],
      afterAction: 'Copy to Home Directory'
    });
  },

  /**
   * @type {Action[]}
   */
  actions: [
    {
      name: 'Copy to Home Directory',
      async execute(fileInfo) {
        return await Process.spawn(`cp '${fileInfo.fullname}' ~/`);
      }
    }
  ]
};
```

### Add Basic Authentication

This is not meaningfully secure. There is no transport security by default, and
the credentials are stored in plain text. But it may offer some peace of mind to
deter casual browsing.

Just populate the config with a dictionary with username keys and password
values.

```javascript
module.exports = {
  afterConfig(config) {
    config.users = {
      'user1': 'password1',
      'user2': 'password2'
    };
  }
}
```

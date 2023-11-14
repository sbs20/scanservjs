# Configuration and integration

Sometimes scanners don't return quite what you want them to. Likewise, perhaps
scanservjs doesn't provide the defaults you want. And maybe you want to do your
own thing after a scan. Furtunately it's possible to override most things you
might want to.

There are various hooks where you can customise behaviour.

TL;DR; copy `/etc/scanservjs/config.default.js` to
`/etc/scanservjs/config.local.js`, override the sections you want and then
restart the app `sudo systemctl restart scanservjs.service`

If you are using docker, then you will want to map the configuration directory
e.g. `--volume /my/local/path:/etc/scanservjs`.

## How it works

scanservjs looks for a file called `/etc/scanservjs/config.local.js` and
attempts to call functions at different stages in the processing.

Note that the config file only gets read at start-up - so if you make changes,
you will need to restart.

See [example source](../app-server/config/config.default.js) for more options.

## `afterConfig(config)`

Whenever the config is read, the result is passed to this function before being
either used or sent down to the browser. This provides a reference to the config
where you can apply your own changes to global settings which include things
like:

  * Server port
  * Log level
  * Preview resolution
  * Output filename
  * Pipelines (output format)

## `afterDevices(devices)`

Whenever the devices are read, the result is passed to this function before
being used. You can alter the device definitions which are reported by SANE
which include scanner dimensions and geometry, modes, resolutions and sources.

## `afterScan(fileInfo)`

Whenever a scan completes, the resultant file is passed to this function. You
receive a reference to the file which has just been scanned; copy it somewhere,
call a script or write some code.

## `actions`

You can define custom actions which can be applied to files either in the UI or
applied at the end of a pipeline (just prior to `afterScan(fileInfo)`). An
action object must have a name and async execute method taking a `FileInfo`:

```javascript
{
  name: 'Copy file to home directory',
  async execute(fileInfo) {
    await Process.spawn(`cp '${fileInfo.fullname}' ~/`);
  }
}
```

## Example file

```javascript
const options = { paths: ['/usr/lib/scanservjs'] };
const Process = require(require.resolve('./server/classes/process', options));

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

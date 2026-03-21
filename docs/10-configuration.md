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
  * PWA appearance (see below)

### PWA configuration

scanservjs can be installed as a Progressive Web App (PWA) — a shortcut on the
home screen or app launcher that opens the scanner UI in a standalone window.
The following `config.pwa` properties can be set inside `afterConfig`:

| Property | Type | Default | Description |
|---|---|---|---|
| `name` | string | `"scanservjs"` | Full application name shown during installation and on the splash screen |
| `shortName` | string | `"Scanner"` | Abbreviated name used where space is limited (e.g. icon labels) |
| `themeColor` | string | `"#1976D2"` | Browser chrome and splash screen colour (CSS colour value) |
| `iconFiles` | string[] | `[]` | Ordered list of absolute paths to icon files served at `/icons/pwa-icon.{ext}`. An empty array uses the built-in scanservjs icons. See notes below. |
| `lockName` | bool | `false` | When `true`, the user cannot rename the app from the Settings page |
| `lockDevice` | bool | `false` | When `true`, the user cannot change the pre-selected scanner from the Settings page |

#### Icon format notes

**SVG** scales perfectly to any size and is the best choice for the browser tab
favicon.  However, Chrome, Chromium, and Android's PWA installer do not accept
SVG entries in the web app manifest — they require a raster image.

**PNG** is required for PWA installation (home screen / app launcher icon).
A 512×512 PNG covers all use cases.  192×192 can also be listed for older
Android versions, but a single 512-pixel image is sufficient today.

Providing both an SVG and a PNG gives the best result across all contexts:
- The SVG is used by the browser for the tab strip and bookmark icon.
- The PNG is used by the OS when installing the PWA.

```javascript
afterConfig(config) {
  config.pwa.name = "Office Scanner";
  config.pwa.shortName = "Scanner";
  config.pwa.themeColor = '#2B6CB0';
  // Both SVG (browser tab) and PNG (PWA install icon) are recommended.
  // PNG is required; omitting it triggers a startup warning and the PWA
  // install icon will be missing or fall back to a browser-generated image.
  config.pwa.iconFiles = [
    '/etc/scanservjs/pwa-icon.svg',   // scalable; browser tab favicon
    '/etc/scanservjs/pwa-icon.png',   // 512×512 raster; required for PWA install
  ];
}
```

All listed files must be readable by the `scanservjs` user.  If a file is
missing, a warning is logged at startup but the server continues to run.
If `iconFiles` is non-empty but contains no PNG (or other raster format),
a warning is logged because Chrome/Chromium will not be able to install the
PWA with a usable icon.

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

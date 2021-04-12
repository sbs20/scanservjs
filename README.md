# scanservjs

[![Build Status](https://img.shields.io/github/workflow/status/sbs20/scanservjs/NodeCI?style=for-the-badge)](https://github.com/sbs20/scanservjs/actions)
[![Code QL Status](https://img.shields.io/github/workflow/status/sbs20/scanservjs/CodeQL?label=CodeQL&style=for-the-badge)](https://github.com/sbs20/scanservjs/actions)
[![Docker Image Size (latest by date)](https://img.shields.io/docker/image-size/sbs20/scanservjs?style=for-the-badge)](https://hub.docker.com/r/sbs20/scanservjs)
[![Docker Pulls](https://img.shields.io/docker/pulls/sbs20/scanservjs?style=for-the-badge)](https://hub.docker.com/r/sbs20/scanservjs)
[![GitHub stars](https://img.shields.io/github/stars/sbs20/scanservjs?label=Github%20stars&style=for-the-badge)](https://github.com/sbs20/scanservjs)
[![GitHub](https://img.shields.io/github/license/sbs20/scanservjs?style=for-the-badge)](https://github.com/sbs20/scanservjs/blob/master/LICENSE.md)

> I've decided to switch to using only this, I find using this in a browser is
> just perfect and way better than bloated software from printer manufacturers

-- *A satisfied user*

scanservjs is a web UI frontend for your scanner. It allows you to share one or
more scanners (using SANE) on a network without the need for drivers or
complicated installation.

### Features

* Cropping
* Source selection (Flatbed / ADF)
* Resolution
* Output formats (TIF, JPG, PNG, PDF and TXT with Tesseract OCR) with varying
  compression settings
* Filters: Autolevels, Threshold, Blur
* Configurable overrides for all defaults as well as filters and formats
* Multipage scanning (with collation for double sided scans)
* Light and dark mode
* **NEW**: International translations: Czech, French, German, Italian, Mandarin,
  Spanish (**help requested**)

It supports any
[SANE compatible devices](http://www.sane-project.org/sane-supported-devices.html).

![screenshot](https://github.com/sbs20/scanservjs/raw/master/docs/screen0.png)

![screenshot](https://github.com/sbs20/scanservjs/raw/master/docs/screen1.png)

Copyright 2016-2021 [Sam Strachan](https://github.com/sbs20)

## Requirements

* SANE Scanner
* Linux host (or VM with necessary pass-through e.g. USB)
* Software sane-utils, ImageMagick, Tesseract (optional) and nodejs

## Installation

* [Manual installation](docs/install.md)
* [Docker installation](docs/docker.md)
* [Development notes](docs/development.md)
* [Configuring the scanner and SANE](docs/sane.md)

## Configuration and device override

If you want to override some specific configuration setting then you can do so
within `./config/config.local.js`. Take a copy of `./config/config.default.js`
and override the sections you want. Using docker you will need to map the volume
using `-v /my/local/path:/app/config` then create a file in your directory
called `config.local.js`. See [example source](./server/config/config.local.js)
for more options.

```javascript
module.exports = {
  /**
   * @param {Configuration} config 
   */
  afterConfig(config) {
    // Set default preview resolution
    config.previewResolution = 300;

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
    const device = devices.filter(d => d.id.startsWith('plustek'))[0];
    if (device) {
      device.features['--mode'].default = 'Color';
      device.features['--resolution'].default = 150;
      device.features['--resolution'].options = [75, 150, 300, 600];
      device.features['--brightness'].default = 0;
      device.features['--contrast'].default = 5;
      device.features['-x'].default = 215;
      device.features['-y'].default = 297;
    }
  }
};
```

## Why?

This is yet another scanimage-web-front-end. Why? It originally started as an
adaptation of phpsane - just to make everything a bit newer, give it a refresh
and make it work on minimal installations without imagemagick - that version is
[still available](https://github.com/sbs20/scanserv) but is no longer
maintained. Since then, I just wanted to write it in node and enhance it a bit,
and it's been a labour of love ever since.

## Acknowledgements

 * This project owes its genesis to
   [phpsane](http://sourceforge.net/projects/phpsane/)
 * [Everyone](https://github.com/sbs20/scanservjs/graphs/contributors) who has
   filed issues, tested, fixed issues, added translations and helped over the
   years. Thank you!

## More about SANE

 * http://www.sane-project.org/
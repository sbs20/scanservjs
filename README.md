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

scanservjs is a web-based UI for your scanner. It allows you to share one or
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
* **NEW**: International translations: Czech, German, Italian, Spanish (**help requested**)

It supports any
[SANE compatible devices](http://www.sane-project.org/sane-supported-devices.html).

![screenshot](https://github.com/sbs20/scanservjs/raw/master/docs/screen0.png)

![screenshot](https://github.com/sbs20/scanservjs/raw/master/docs/screen1.png)

Copyright 2016-2021 [Sam Strachan](https://github.com/sbs20)

## Requirements
* SANE Scanner
* Linux host (or VM with necessary pass-through e.g. USB)
* Software sane-utils, ImageMagick, Tesseract (optional) and nodejs

## Installation notes
For an easy docker-based install (assuming that SANE supports your scanner
out-of-the-box on Debian) use the following commands:

```console
docker pull sbs20/scanservjs:latest
docker rm --force scanservjs-container 2> /dev/null
docker run -d -p 8080:8080 -v /var/run/dbus:/var/run/dbus --restart unless-stopped --name scanservjs-container --privileged sbs20/scanservjs:latest
```

scanservjs will now be accessible from `http://$host:8080/`

* ⚠ By default, configuration and scanned images are stored within the container
  and will be lost if you recreate it. If you want to map your scanned images
  then specify the volume mapping option `-v /local/path/:/app/data/output/`
* ⚠ The docker image is amd64 only - and will not work on ARM devices such as
  the Raspberry Pi. Please follow the manual installation process in these
  cases
* ⚠ `--privileged` is required for the container to access the host's devices,
  to allow it to talk to the scanner. The best way to do this is to map the
  actual USB ports. Run `sudo sane-find-scanner -q` and you will get a result
  like
  `found USB scanner (vendor=0x04a9 [Canon], product=0x220d [CanoScan], chip=LM9832/3) at libusb:001:003`.
  This translates to `/dev/bus/usb/001/003`. In turn the docker argument would
  be `--device=/dev/bus/usb/001/003:/dev/bus/usb/001/003`. However, oftentimes,
  there are [reports](#66) that devices change address across reboots which
  complicates matters.
* ⚠ Driverless-mode scanning (using airscan over IPP-USB) seems to result in
  problems. If anyone has ideas why (perhaps something additional needs sharing
  from host to guest) then suggestions are welcome. What seems to work well as
  an alternative is
  [network-sharing the scanner](https://github.com/sbs20/scanservjs/issues/129#issuecomment-800226184)
  on the host and referencing that within the guest.

If you want to install the latest staging branch (this may contain newer code)

```console
docker pull sbs20/scanservjs:staging
docker rm --force scanservjs-container 2> /dev/null
docker run -d -p 8080:8080 -v /var/run/dbus:/var/run/dbus --restart unless-stopped --name scanservjs-container --privileged sbs20/scanservjs:staging
```

More installation options:

* [Manual installation notes](docs/install.md)
* [Development notes](docs/development.md)
* [Configuring the scanner and SANE](docs/sane.md)

## Environment variables

* `SANED_NET_HOSTS`: If you want to use a
  [SaneOverNetwork](https://wiki.debian.org/SaneOverNetwork#Server_Configuration)
  scanner then to perform the equivalent of adding hosts to
  `/etc/sane.d/net.conf` specify a list of ip addresses separated by semicolons
  in the `SANED_NET_HOSTS` environment variable.
* `AIRSCAN_DEVICES`: If you want to specifically add `sane-airscan` devices to
  your `/etc/sane.d/airscan.conf` then use the `AIRSCAN_DEVICES` environment
  variable (semicolon delimited).
* `DELIMITER`: if you need to inlcude semi-colons (`;`) in your environment
  variables, this allows you to choose an alternative delimiter.
* `DEVICES`: Force add devices use `DEVICES` (semicolon delimited)
* `SCANIMAGE_LIST_IGNORE`: To force ignore `scanimage -L`

## Configuration and device override
If you want to override some specific configuration setting then you can do so
within `./config/config.local.js`. Take a copy of `./config/config.default.js`
and override the sections you want. Using docker you will need to map the volume
using `-v /my/local/path/:/app/config/` then create a file in your directory
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

## Airscan
[sane-airscan](https://github.com/alexpevzner/sane-airscan) uses Avahi /
Zeroconf / Bonjour to discover devices on the local network. If you are running
docker you will want to share dbus to make it work
(`-v /var/run/dbus:/var/run/dbus`).

## Example docker run

### Use airscan and a locally detected scanner
This should support most use cases

```console
docker run -d -p 8080:8080 \
  -v /var/run/dbus:/var/run/dbus \
  --name scanservjs-container --privileged scanservjs-image
```

### Complicated
Add two net hosts to sane, use airscan to connect to two remote scanners, don't
use `scanimage -L`, force a list of devices and override the OCR language

```console
docker run -d -p 8080:8080 \
  -e SANED_NET_HOSTS="10.0.100.30;10.0.100.31" \
  -e AIRSCAN_DEVICES='"Canon MFD" = "http://192.168.0.10/eSCL";"EPSON MFD" = "http://192.168.0.11/eSCL"' \
  -e SCANIMAGE_LIST_IGNORE=true \
  -e DEVICES="net:10.0.100.30:plustek:libusb:001:003;net:10.0.100.31:plustek:libusb:001:003;airscan:e0:Canon TR8500 series;airscan:e1:EPSON Cool Series" \
  -e OCR_LANG="fra" \
  -v /var/run/dbus:/var/run/dbus \
  --name scanservjs-container --privileged scanservjs-image
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

## More about SANE
 * http://www.sane-project.org/
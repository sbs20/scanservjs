# scanservjs

[![Build Status](https://img.shields.io/github/actions/workflow/status/sbs20/scanservjs/build.yml?branch=master&style=for-the-badge)](https://github.com/sbs20/scanservjs/actions)
[![Code QL Status](https://img.shields.io/github/actions/workflow/status/sbs20/scanservjs/codeql-analysis.yml?branch=master&style=for-the-badge&label=CodeQL)](https://github.com/sbs20/scanservjs/actions)
[![Docker Image Size (latest by date)](https://img.shields.io/docker/image-size/sbs20/scanservjs?style=for-the-badge)](https://hub.docker.com/r/sbs20/scanservjs)
[![Docker Pulls](https://img.shields.io/docker/pulls/sbs20/scanservjs?style=for-the-badge)](https://hub.docker.com/r/sbs20/scanservjs)
[![GitHub stars](https://img.shields.io/github/stars/sbs20/scanservjs?label=Github%20stars&style=for-the-badge)](https://github.com/sbs20/scanservjs)
[![GitHub](https://img.shields.io/github/license/sbs20/scanservjs?style=for-the-badge)](https://github.com/sbs20/scanservjs/blob/master/LICENSE.md)

![screenshot](https://github.com/sbs20/scanservjs/raw/master/docs/screen0.jpg)

Copyright 2016-2023 [Sam Strachan](https://github.com/sbs20)

## What people are saying

> I've decided to switch to using only this, I find using this in a browser is
> just perfect and way better than bloated software from printer manufacturers


> It enabled me to still use my old hp3900 scanner without worrying about
> drivers and vendor specific UIs. Furthermore, scans just being accessible via
> an awesome web interface makes it even more brilliant!


> This is a great project! The touchscreen and buttons on my Brother scanner are
> broken, meaning the device is useless by itself because one cannot trigger
> scans, but with this project I can trigger it remotely just fine.


> Absolutely love untethering my scanner from my laptop. Also means that I know
> it will work "forever", regardless of OS updates, since its all just a docker
> container.

## About

scanservjs is a web UI frontend for your scanner. It allows you to share one or
more scanners (using SANE) on a network without the need for drivers or
complicated installation.

## Features

* Cropping
* Source selection (Flatbed / ADF)
* Resolution
* Output formats (TIF, JPG, PNG, PDF and TXT with Tesseract OCR) with varying
  compression settings
* Filters: Autolevels, Threshold, Blur
* Configurable overrides for all defaults as well as filters and formats
* Multipage scanning (with collation for double sided scans)
* International translations: Arabic, Czech, Dutch, French, German, Hungarian,
  Italian, Mandarin, Polish, Portuguese (PT & BR), Russian, Slovak, Spanish,
  Turkish, Ukrainian;
  [Help requested](https://github.com/sbs20/scanservjs/issues/154)
* Light and dark mode
* Responsive design
* Docker images for `amd64`, `arm64` and `armv7`
* Swagger API documentation

It supports any
[SANE compatible devices](http://www.sane-project.org/sane-supported-devices.html).

## Requirements

* SANE Scanner
* Linux host (or VM with necessary pass-through e.g. USB)
* Software sane-utils, ImageMagick, Tesseract (optional) and nodejs

## Documentation

* [Manual installation](docs/install.md)
* [Docker installation](docs/docker.md)
* [Scanner and SANE setup](docs/sane.md)
* [Proxy setup](docs/proxy.md)
* [Troubleshooting](docs/troubleshooting.md)
* [Development notes](docs/development.md)
* [Configuration and device override](docs/config.md)
* [Integration](docs/integration.md)

## Running scanservjs

In most cases the use of the app should be fairly self-explanatory. When the app
first loads, it attempts to detect your scanner - this step is the most
precarious and may either require custom drivers or some additional steps if
you're running a network scanner or docker. See the documentation above for
more.

Once the scanner is detected then you have a number of pages.

### Scan

This page gives access to the controls for your scanner. The app will generally
find the settings available automatically, although some scanners mis-report
their abilities. (If this is the case, then you can override what's detected,
see [Configuration and device override](docs/config.md) for more). If geometry
is available (selecting scan size and position) then you will have cropping
available to you.

There is also the ability to perform batch scanning. If you have a document
feeder, then just use the `Auto` option. If not then use `Manual` and the app
will prompt you to change pages between scans.

Any scan operation will always result in a single file. Some image formats, such
as PDF and TIF support multiple pages, while others, such as PNG and JPG do not.
If the scan pipeline results in more than one file, then the app will zip the
files into a single output. You can choose the image format under `Format`.

You can create and customise your own pipelines.

### Files

Any scanned files will be saved in a flat directory which has a simple web view
available on this page. The intended usage of the app is to allow the user to
save their scans locally - i.e. to download the files. The app will never delete
these files, but if you run under docker then unless volume mapping is specified
then the files may be lost when you run a new version.

Furthermore, users in real life will want to store their scans with their own
names, directory structures and cloud services or NAS devices. The permutations
and possibilities are endless and are beyond the scope of the app.

### Settings

The settings page allows you to change the appearance and locale / language.

### About

Copyright information and system info.

## Swagger API documentation

There is built in swagger documentation with an API explorer. Access it direct
using `/api-docs` or navigate from the `About` page.

![swagger](https://github.com/sbs20/scanservjs/raw/master/docs/swagger.png)

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

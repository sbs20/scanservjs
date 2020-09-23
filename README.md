# scanservjs
scanservjs is a simple web-based UI for your scanner. It allows you to share a
scanner (using SANE) on a network without the need for drivers or complicated
installation. It can save to TIF, JPG, PNG, PDF and TXT (with Tesseract OCR)
with varying compression settings, all of which can configured. It supports
multipage scanning and all
[SANE compatible devices](http://www.sane-project.org/sane-supported-devices.html).

![screenshot](https://github.com/sbs20/scanservjs/raw/master/docs/screen0.png)

Copyright 2016-2020 [Sam Strachan](https://github.com/sbs20)

## Requirements
* SANE
* ImageMagick
* Tesseract (optional)
* nodejs

## Installation notes
For an easy docker-based install (assuming that SANE supports your scanner
out-of-the-box on Debian) use the following commands. Please note that by
default, configuration and scanned images are stored within the container and
will be lost if you recreate it. If you want to map your scanned images then
specify the volume mapping option `-v /local/path/:/app/data/output/`

**Please note that the docker image is amd64 only - and will not work on ARM
devices such as the Raspberry Pi. Please follow the manual installation process
in these cases**

```console
docker pull sbs20/scanservjs:latest
docker rm --force scanservjs-container 2> /dev/null
docker run -d -p 8080:8080 --restart unless-stopped --name scanservjs-container --privileged sbs20/scanservjs:latest
```
(`--privileged` is required for the container to access the host's devices, to
allow it to talk to the scanner)

scanservjs will now be accessible from `http://$host:8080/`

If you want to install the latest staging branch (this may contain newer code)

```console
docker pull sbs20/scanservjs:staging
docker rm --force scanservjs-container 2> /dev/null
docker run -d -p 8080:8080 --restart unless-stopped --name scanservjs-container --privileged sbs20/scanservjs:staging
```

More installation options:

* [Manual installation notes](docs/install.md)
* [Development notes](docs/development.md)
* [Configuring the scanner and SANE](docs/sane.md)

## Why?
This is yet another scanimage-web-front-end. Why? It originally started as an
adaptation of phpsane - just to make everything a bit newer, give it a refresh
and make it work on minimal installations without imagemagick - that version is
[still available](https://github.com/sbs20/scanserv) but is no longer
maintained. Then, I just wanted to write it in node and enhance it a bit, and
it's been a labour of love ever since.

## Acknowledgements
 * This project owes a lot to [phpsane](http://sourceforge.net/projects/phpsane/)

## More about SANE
 * http://www.sane-project.org/
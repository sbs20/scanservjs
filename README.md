# scanservjs
scanservjs is a simple web-based UI for your scanner. It allows you to share a
scanner (using SANE) on a network without the need for drivers or complicated
installation. It can save to TIF, JPG, PNG and PDF with varyings compression
settings. It also allows for configurable output conversions through
configuration.

![screenshot](https://github.com/sbs20/scanservjs/raw/master/docs/screen0.png)

Copyright 2016 [Sam Strachan](https://github.com/sbs20)

## Requirements
* SANE
* ImageMagick
* nodejs

## Installation notes
For an easy docker-based install (assuming that SANE supports your scanner
out-of-the-box on Debian):

```console
docker build -t scanservjs-image .
docker rm --force scanservjs-container 2> /dev/null
docker run -d -p 8080:8080 --name scanservjs-container --privileged scanservjs-image
```
(`--privileged` is required for the container to access the host's devices, to
allow it to talk to the scanner)

scanservjs will now be accessible from `http://$host:8080/`

More installation options:

* Manual installation notes [here](docs/install.md)
* [development notes](development.md)

## Why?
This is yet another scanimage-web-front-end. Why? It originally started as an
adaptation of phpsane - just to make everything a bit newer, give it a refresh
and make it work on minimal installations without imagemagick - that version is
[still available](https://github.com/sbs20/scanserv) but is no longer
maintained. Then, I just wanted to write in node, and it's been a labour of love
ever since.

## Roadmap
* Configuration page for debugging set up assisting new users
* Multi-language support

## Acknowledgements
 * This project owes a lot to [phpsane](http://sourceforge.net/projects/phpsane/)

## More about SANE
 * http://www.sane-project.org/
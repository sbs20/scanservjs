# Testing

## Summary

Where possible there are automated unit tests. These are built into the build
pipeline and can be run independently with `npm run test`.

However, this app needs to run in all combinations of the following:

### Architectures:

* AMD64
* ARM

### Operating systems:

* Debian 10 Buster
* Debian 11 Bullseye
* Debian 12 Bookworm
* Arch

### Node versions

* 10+

### Browsers

* Not Internet Explorer

### Mode

* Container
* Native
  * Installing DEB over legacy
  * Upgrading DEB

Where possible, the app has been designed to minimise the differences with all
permuations.

* Docker builds a deb file and installs that
* Docker uses Debian 12 and Node 18
* There are no known architecture differences

Nonetheless there is a lot to cover.

## Test plan

Depending on the scope of change any of the following may be required. For a
major release, all tests should be run. For a minor one, the scope can be
reduced.

### Application testing

* Find scanners
* Test config overrides
* Preview
* Filters
* Any changed pipelines
* Scan
* Settings
* About and system info

### Docker

* Build the image
* Run the container
* Verify find scanners and system info

### DEB

* Verify install, remove
* Verify install, update
* Verify purge
* Run on Buster, Bullseye, Bookworm, RaspberryPi OS

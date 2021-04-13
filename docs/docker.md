# Running scanservjs under docker

## Quickstart

Get the image

```sh
docker pull sbs20/scanservjs:latest
```

Run it

```sh
docker rm --force scanservjs-container 2> /dev/null
docker run -d \
  -p 8080:8080 \
  -v /var/run/dbus:/var/run/dbus \
  --restart unless-stopped \
  --name scanservjs-container \
  --privileged sbs20/scanservjs:latest
```

## General notes

* ⚠ By default, configuration and scanned images are stored within the container
  and will be lost if you recreate it. If you want to map your scanned images
  then see mapping section below
* ⚠ The docker image is amd64 only - and will not work on ARM devices such as
  the Raspberry Pi. Please follow the manual installation process in these
  cases

## Accessing hardware

Docker is great for certain tasks. But it's less ideal for situations where the
container needs to access the host hardware. The "simple" solution is to run
with `--privileged` but that gives your container full root access to the host -
you're putting a lot of trust in the container. In short, best not.

Depending on your setup you have a number of options.

* If your scanner is connected by USB to the host then you can map the device.
  The best way to do this is to map the actual USB ports.
  * Run `sudo sane-find-scanner -q` and you will get a result like
    `found USB scanner (vendor=0x04a9 [Canon], product=0x220d [CanoScan], chip=LM9832/3) at libusb:001:003`.
  * Or run `lsusb` which gives you
    `Bus 001 Device 003: ID 04a9:220d Canon, Inc. CanoScan N670U/N676U/LiDE 20`.
  * Both translate to `/dev/bus/usb/001/003`.
  * The docker argument would be
    `--device=/dev/bus/usb/001/003:/dev/bus/usb/001/003`

* If your scanner is driverless over the network, then
  [sane-airscan](https://github.com/alexpevzner/sane-airscan) should be able to
  figure it out - but it uses Avahi / Zeroconf / Bonjour to discover devices on
  the local network. You will want to share dbus to make it work
  (`-v /var/run/dbus:/var/run/dbus`).

* If your container is running inside a VM you may find that the USB device id
  is [unstable](https://github.com/sbs20/scanservjs/issues/66) and changes
  between boots. In these cases, you will probably find it easier to share the
  scanner over the network on the host.

* Driverless-mode scanning (using airscan over IPP-USB) seems to result in
  problems. If anyone has ideas why (perhaps something additional needs sharing
  from host to guest) then suggestions are welcome.

* If you need proprietary drivers for your scanner then the best solution is
  either to create your own docker image based on the scanservjs one and add it
  in that way, or to install the drivers on the host and share it over the
  network. Adding more backends to the docker container feels wrong and will add
  cruft for many users who don't need it.
  
* The best fallback position for many cases is simply to
  [share the host scanner over the network](https://github.com/sbs20/scanservjs/issues/129#issuecomment-800226184)
  and referencing that within the guest. This means that the docker container is
  just running the app.

## Mapping volumes

There are two volumes you may wish to map:

* The scanned images: use `-v /local/path/scans:/app/data/output`
* Configuration overrides: use `-v /local/path/cfg:/app/config`

## User and group mapping

The docker image which is created now runs under a non-privileged user account
with a UID of `2001`. If you attempt to run as a user other than `2001` or `0`
(e.g. `-u 1000`) then the process inside the container will no longer have
access to some of the things it needs to and it will fail. Most of the time you
won't care about the user, but if you're mapping volumes for either config or
data, then it may matter.

The solution in most cases is either to
* change the group of the container to a known group on the host e.g.
  `-u 2001:1000`. This will keep the user correct (`2001`) but change the group
  (`1000`)
* create a corresponding user on the host e.g.
  `useradd -u 2001 -ms /bin/bash scanservjs`
* change the host volume permissions e.g. `chmod 777 local-volume`

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

## Examples

### Mapped USB device with mapped volumes

```sh
docker run -d \
  -p 8080:8080 \
  -v $HOME/scan-data:/app/data/output \
  -v $HOME/scan-cfg:/app/config \
  --device /dev/bus/usb/001/003:/dev/bus/usb/001/003 \
  --name scanservjs-container scanservjs-image
```

### Use airscan and a locally detected scanner

This should support most use cases

```sh
docker run -d -p 8080:8080 \
  -v /var/run/dbus:/var/run/dbus \
  --name scanservjs-container scanservjs-image
```

### A bit of everything

Add two net hosts to sane, use airscan to connect to two remote scanners, don't
use `scanimage -L`, force a list of devices, override the OCR language and run
in privileged mode

```sh
docker run -d -p 8080:8080 \
  -e SANED_NET_HOSTS="10.0.100.30;10.0.100.31" \
  -e AIRSCAN_DEVICES='"Canon MFD" = "http://192.168.0.10/eSCL";"EPSON MFD" = "http://192.168.0.11/eSCL"' \
  -e SCANIMAGE_LIST_IGNORE=true \
  -e DEVICES="net:10.0.100.30:plustek:libusb:001:003;net:10.0.100.31:plustek:libusb:001:003;airscan:e0:Canon TR8500 series;airscan:e1:EPSON Cool Series" \
  -e OCR_LANG="fra" \
  -v /var/run/dbus:/var/run/dbus \
  --name scanservjs-container --privileged scanservjs-image
```

## Staging builds

These may be less stable, but also have upcoming features.

If you want to install the latest staging branch (this may contain newer code)

```sh
docker pull sbs20/scanservjs:staging
docker rm --force scanservjs-container 2> /dev/null
docker run -d -p 8080:8080 -v /var/run/dbus:/var/run/dbus --restart unless-stopped --name scanservjs-container --privileged sbs20/scanservjs:staging
```

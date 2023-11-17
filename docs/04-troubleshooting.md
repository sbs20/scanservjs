# Troubleshooting

## Overview

Scanservjs works by wrapping CLI calls to `scanimage` as the user `scanservjs`
which is a member of the `scanner` group. The chances are that if scanservjs
does not work, then neither does `scanimage`.

`scanimage` can either connect to:

* some hardware (e.g. USB or SCSI), in which case you may need to look at
  permissions and `udev` rules or
* a network device, in which case you need a network route

## Getting logs

Use `journalctl`. See the journalctl manpage for details but the following
should be enough to get you started.

```sh
sudo journalctl -e -u scanservjs
```

## Verify connectivity

* Try running `scanimage -L`. You should see something like:
  ```log
  device `airscan:e0:Canon' is a eSCL Canon ip=10.0.109.3
  ```
* If you don't see anything, then try as root `sudo scanimage -L` (for
  diagnostic purposes) - this really should work. If it doesn't, then it's most
  likely a SANE / driver related issue.
* If it works with `sudo` but not without, then this is just a permissions
  issue. See below.
* If `scanimage` does not work, then try: `sane-find-scanner -q`; you should see
  a result like:
  ```log
  found USB scanner (vendor=0x04a9 [Canon], product=0x220d [CanoScan]) at libusb:003:005
  ```

  If nothing is working at this point, then this we're into the realms of
  checking to see what version of SANE you're running and if your scanner is
  supported.

## Verify connectivity for scanservjs

Try running as the application user:

```sh
sudo su --shell /bin/bash - scanservjs --command 'scanimage -L'
```

If this does not work, see below. If it does then take it a step further and run
a scan:

```sh
sudo su --shell /bin/bash - scanservjs --command 'scanimage --format tiff > test.tif'
```

which should output a tif file in the scanservjs home directory
(`/var/lib/scanservjs/`). If you can get this to work then scanservjs should
be working fine.

## Permissions; `scanimage` works with `sudo` but not without

Most likely you need a udev rule, but also verify group membership.

* Add a udev rule for the scanner device. Use the vendorId:productId from
  `lsusb` and add to `/etc/udev/rules.d/55-libsane.rules` as
  
  ```ini
  ATTRS{idVendor}=="04a9", ATTRS{idProduct}=="220d", MODE="0666", GROUP="scanner", ENV{libsane_matched}="yes"
  ```

  Unplug / replug the scanner (don't skip this!).

* Verify `scanservjs` is in the `scanner` group: `groups scanservjs`.

## scanimage: sane_read: Invalid argument

This is a problem with SANE rather than scanservjs. It usually signifies a
[problem with the driver](https://askubuntu.com/a/447283). Your best bet is
going back to first principles with SANE itself. Follow the steps
[here](./install.md#troubleshooting)

## Cropping results in incorrect positioning

Some scanners mis-report their size - don't know why, but they do. This means
that when the app attempts to crop things the maths is all wrong. The best way
around this is to override the reported scanner dimensions. See
[this recipe](./config.md#override-scanner-dimensions) for more.

## JSON.parse error

This happens when the browser received a string from the server which is not a
valid JSON string. Most likely you're running a proxy server (e.g. nginx) which
is timing out prior to the completion of the request. Scanservjs can sometimes
take a little while to fulfil its requests - usually because it's waiting for a
scanner, but sometimes because it's having to do a fair amount of image
processing and you're
[running on a low power CPU (e.g. RPi)](https://github.com/sbs20/scanservjs/issues/224).

The solution is to increase the proxy timeout. For nginx that might look like:

```conf
server{
   ...
   proxy_read_timeout 300;
   proxy_connect_timeout 300;
   proxy_send_timeout 300; 
   ...
}
```

## Long scan timeout

When scanning files with high resolution, e.g. 1200dpi it is very likely for the
request to timeout. This is because node HTTP times out after 2 minutes by
default. The solution is to increase the default timeout. That's possible by
setting `config.timeout = 600000;` (for 10 minutes for example).

## Docker container loses scanner after device reboot

As per
[issue #505](https://github.com/sbs20/scanservjs/issues/505#issuecomment-1364533826)
containers can lose their access to a device after a device reboot.

This is more SANE and containers than this app. The user's solution was to add a
udev rule as below. You will need to substitute your own product and vendor
variables.

`/etc/udev/rules.d/99-printer.rules`
```ini
SUBSYSTEMS=="usb",KERNELS=="1-1.1",DRIVERS=="usb",ATTRS{idProduct}=="0827", ATTRS{idVendor}=="04b8", ATTRS{serial}=="L53010612130846360",SYMLINK+="%s{manufacturer}_printer",TAG+="systemd",RUN+="/bin/bash -c '/usr/bin/systemctl restart container-scanservjs.service &'"
```

## Poor quality (weird or blocky) scans on Raspberry Pi

USB-only scanners draw a lot of current relative to the Pi's available power.
This can manifest itself in unusual scans - technically valid images but with
odd colours and block transforms. Consider using a powered USB hub (e.g. for a
Canon LIDE 20). If you encounter similar then see
[here](https://www.raspberrypi.org/forums/viewtopic.php?f=28&t=53832).

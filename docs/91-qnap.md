# QNAP NAS

This page is more or less abandoned. I no longer have any QNAP hardware and am
unable to test or experiment.

It's likely that the application will work at a fundamental level, but will
require some effort to install the necessary packages.

These instructions may serve as a useful starting point to get going. I will
gladly receive PRs which either update this document or assist with creating a
QNAP package.

### install [Works on QTS 4.2.2]

 * [Install Entware](basics.md)
 * SSH into your NAS - e.g. use PuTTY as admin
 * Plug your scanner into a USB port
 * Type `lsusb` to check the scanner is attached
 * At the terminal type the following commands
    * `opkg update`
    * `opkg install sane-frontends imagemagick sudo`
 * Confirm installation typing...
    * `sane-find-scanner -q`
    * `scanimage -L`

### Get permissions working

Pretend to be httpduser

```sh
sudo -i -u httpdusr
```

If (when) that fails you need to edit sudoers and try again

```sh
echo "admin ALL=(ALL) ALL" >> /opt/etc/sudoers
```

Once you're httpdusr then

```sh
/opt/bin/scanimage -L
```

There are any number of problems you might face here. Your user probably won't
have access to "scanimage" or usb devices or the sane.d directory. And you
should probably do this with a group privilege.

* [This thread](https://wiki.archlinux.org/index.php/SANE) and
* [that thread](https://bugs.launchpad.net/ubuntu/+source/sane-backends/+bug/270185/comments/3)
  are really useful. The short version is to do this:

```sh
addgroup scanner
usermod -G scanner httpdusr
chgrp scanner /dev/usb/*
chmod g+rw /dev/usb/*
chgrp scanner /opt/bin/scanimage
chmod 644 /opt/etc/sane.d/*
```

Find out the bus and device of your scanner using `lsusb` ...

```log
Bus 003 Device 003: ID 04a9:220d Canon, Inc. CanoScan N670U/N676U/LiDE 20
```

Then do this: chgrp scanner /proc/usb/{bus}/{dev} - so I did this:

```sh
chgrp scanner /proc/usb/003/003
```

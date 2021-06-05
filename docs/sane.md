# SANE, imagemagick, scanners

## Install

Just use your package manager.

  * Debian / Ubuntu / Raspbian: `sudo apt install sane-utils imagemagick`
  * Arch: `sudo pacman -S sane`

## Validate SANE is working

Either try:

```sh
$ scanimage -L
device `net:localhost:plustek:libusb:001:004' is a Canon CanoScan N1240U/LiDE30 flatbed scanner
```

or

```sh
$ sane-find-scanner -q
found USB scanner (vendor=0x04a9 [Canon], product=0x220d [CanoScan]) at libusb:003:005
```

If you do not see the expected result then try each with `sudo` which really
should work; this is a diagnostic approach, not a solution. If it works then we
have established it's not a hardware / driver issue.

There are a variety of approaches to fixing permissions according to what the
underlying problem is. In order of likelihood: 

  * Add a udev rule for the scanner device. Use the vendorId:productId from 
    `lsusb` and add to `/etc/udev/rules.d/55-libsane.rules` as
    `ATTRS{idVendor}=="04a9", ATTRS{idProduct}=="220d", MODE="0666", GROUP="scanner", ENV{libsane_matched}="yes"`.
    Unplug / replug the scanner.
  * Add current user to the `scanner` group

## Defining network scanners

### Configuring the server

Assume the host (the device the scanner is connected to) has an IP of
`192.168.0.10`

```sh
# Allow access from the following networks
## Local network
echo "192.168.0.0/24" >> /etc/sane.d/saned.conf
## Default docker network
echo "172.17.0.0/16" >> /etc/sane.d/saned.conf
sudo systemctl enable saned.socket
sudo systemctl start saned.socket
```

### Configuring the client

Add the host (`192.168.0.10`) to the client.

```sh
echo "192.168.0.10" >> /etc/sane.d/net.conf
```

Now if you run `scanimage -L` on the client you should see the scanner on the
host (prefixed with `net:192.168.0.10:`)

For more information on configuring the server and client see
[SaneOverNetwork](https://wiki.debian.org/SaneOverNetwork#Server_Configuration).

It's worth noting that network scanners do not always show up on the client. In
such cases you will need to get the device name from the host, prefix it with
`net:$ip:` and use the `-d` switch. From the scanimage manpage:

> The -L or --list-devices option requests a (partial) list of devices that are
> available. The list is not complete since some devices may be available, but
> are not listed in any of the configuration files (which are typically stored
> in directory /etc/sane.d). This is particularly the case when accessing
> scanners through the network. If a device is not listed in a configuration
> file, the only way to access it is by its full device name. You may need to
> consult your system administrator to find out the names of such devices.

## Scanners requiring additional drivers

Some scanner models require additional drivers to function with SANE. For
example, Brother offers proprietary drivers for their USB and network scanners.
Please follow the manufacturer's instructions for setting up such scanners.
Once a scanner is listed in `scanimage -L`, it should be ready to use with
scanservjs.

## SANE Airscan

You may find [sane-airscan](https://github.com/alexpevzner/sane-airscan) useful
for supporting newer eSCL and WSD devices as the standard sane-escl package
doesn't seem to be widely available in most package managers yet. Once installed
you should just find that it works with a simple `scanimage -L`. You can also
specify a specific name for the device in `/etc/sane.d/airscan.conf`

```console
[devices]
"My scanner" = "http://10.0.111.4/eSCL"
```

Your URI will be different. You shouldn't need to do that though.

Airscan relies on bonjour to make it work - which means broadcasting to the
local subnet to autodiscover the device. If you are running on a different
subnet, the autodiscovery won't work. You have two options:

1. Use avahi reflector which "just" reflects broadcasts across the subnets
   ```
   apt-get install avahi-daemon -y sed -i "s/#enable-reflector=no/enable-reflector=yes/g" /etc/avahi/avahi-daemon.conf
   systemctl restart avahi-daemon
   ```
2. If have servers galore then you can create a saned host in the same subnet as
   the scanner which uses airscan to reach the scanner, but re-shares the
   scanner as a SANED network scanner (see above) - we'll call this
   `The bridge`. Then have your `scanimage` client reference `The bridge` as a
   remote scanner host and add the IP address of `The bridge` to
   `/etc/sane.d/net.conf` on the client (which will be the scanservjs server).
   You may also need to add the full device name to the devices list in the
   config e.g.
   ```javascript
   //config.devices.push('net:${bridge}:${device});
   config.devices.push('net:10.0.100.171:airscan:e0:Canon TR8500 series-5);
   ```

## For QNAP NAS

Please note - these instructions may be long out of date. If they are incorrect
then feel free to raise and issues or PR.

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
```
sudo -i -u httpdusr
```

If (when) that fails you need to edit sudoers and try again

```
echo "admin ALL=(ALL) ALL" >> /opt/etc/sudoers
```

Once you're httpdusr then
```
/opt/bin/scanimage -L
```

There are any number of problems you might face here. Your user probably won't
have access to "scanimage" or usb devices or the sane.d directory. And you
should probably do this with a group privilege.

[This thread](https://wiki.archlinux.org/index.php/SANE) and 
[that thread](https://bugs.launchpad.net/ubuntu/+source/sane-backends/+bug/270185/comments/3)
are really useful. The short version is to do this:

```
addgroup scanner
usermod -G scanner httpdusr
chgrp scanner /dev/usb/*
chmod g+rw /dev/usb/*
chgrp scanner /opt/bin/scanimage
chmod 644 /opt/etc/sane.d/*
```

Find out the bus and device of your scanner using `lsusb` ...
```
Bus 003 Device 003: ID 04a9:220d Canon, Inc. CanoScan N670U/N676U/LiDE 20
```
Then do this: chgrp scanner /proc/usb/{bus}/{dev} - so I did this:
```
chgrp scanner /proc/usb/003/003
```

## Raspberry Pi

USB-only scanners draw a lot of current relative to the Pi's available power.
This can manifest itself in unusual scans - technically valid images but with
odd colours and block transforms. Consider using a powered USB hub (e.g. for a
Canon LIDE 20). If you encounter similar then see
[here](https://www.raspberrypi.org/forums/viewtopic.php?f=28&t=53832).

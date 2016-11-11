# installation

## QNAP NAS install [Works on QTS 4.2.2]
 * [Install Entware](https://github.com/sbs20/qnap-cookbook/blob/master/basics.md)
 * SSH into your NAS - e.g. use PuTTY as admin
 * Plug your scanner into a USB port
 * Type `lsusb` to check the scanner is attached
 * At the terminal type the following commands
    * `opkg update`
    * `opkg install sane-frontends imagemagick sudo`
 * Confirm installation typing...
    * `sane-find-scanner -q`
    * `scanimage -L`

### Pretend to be httpduser
```
sudo -i -u httpdusr
```

If (when) that fails you need to edit sudoers and try again

```
nano /opt/etc/sudoers
```
add 
```
admin ALL=(ALL) ALL
```

Once you're httpdusr then ....
```
/opt/bin/scanimage -L
```
There are any number of problems you might face here. Your user probably won't have
access to "scanimage" or usb devices or the sane.d directory. And you should probably
do this with a group privilege.

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

Find out the bus and device of your scanner using lsusb ...
```
Bus 003 Device 003: ID 04a9:220d Canon, Inc. CanoScan N670U/N676U/LiDE 20
```
Then do this: chgrp scanner /proc/usb/bus/dev - so I did this:
```
chgrp scanner /proc/usb/003/003
```

### Install the website
```
cd ~
wget --no-check-certificate https://github.com/sbs20/scanserv/archive/master.zip
cd /share/Qweb
sudo unzip ~/master.zip
sudo mv scanserv-master/ scanserv
```

### Set variables correctly
```
/opt/bin/nano /share/Qweb/classes_php/Config.php
```
Then set the Scanimage and Convert lines - mine were as follows
```
<?php
class Config {
        const IsTrace = false;
        const TraceLineEnding = "<br>\n";
        const Scanimage  = "/opt/bin/scanimage";
        const Convert  = "/usr/local/sbin/convert";
        const BypassSystemExecute = false;
        const OutputDirectory = "./output/";
        const PreviewDirectory = "./preview/";
        const MaximumScanWidthInMm = 215;
        const MaximumScanHeightInMm = 297;
}
?>
```

### Test
 * You may need to set the permissions of your new directory: `chmod 775 /share/Qweb/scanserv`
 * Ensure your QNAP web server is running
 * Open your browser and navigate to http://YOUR_QNAP:PORT/scanserv/ 



## Raspberry Pi
*Please note:* USB only scanners draw a lot of current relative to the Pi's available power. This manifested itself
in unusual scans - technically valid images but with odd colours and block transforms. So I needed to switch and 
use a powered USB hub for my Canon LIDE 20. Because of my USB3.0 hub that in turn led to USB issues. If you encounter
similar then see here: https://www.raspberrypi.org/forums/viewtopic.php?f=28&t=53832

First we need to install sane, apache, and php5

```
sudo apt-get update
sudo apt-get install apache2 apache2-utils libapache2-mod-php5 php5 sane-utils imagemagick
```

### Check SANE is working
You need to configure sane here - configuring sane is outside the scope of this document, although I have 
found that I didn't need to do anything. To check it's setup correctly see if scanimage -L shows a net scanner

```
pi@printserver:~ $ scanimage -L
```
Should show: something like 
    device `net:localhost:plustek:libusb:001:004' is a Canon CanoScan N1240U/LiDE30 flatbed scanner

### Check apache can use SANE
If you know about saned and permissions then you may not need to worry about this.
```
sudo su -m www-data -c 'scanimage --test'
```
if not then try
```
sudo gpasswd -a www-data scanner
```

### Download and configure
Download and install scanserv (note, this will download a file called master.zip to the current user's home
directory). 

```
cd ~
sudo wget https://github.com/sbs20/scanserv/archive/master.zip
```
Note, older versions of raspbian install web pages in /var/www, we are assuming /var/www/html as that is 
what newer versions use. We are going to install scanserv so that you can access it with the url
http://my.pi.example.com/scanserv

```
cd /var/www/html
sudo unzip ~/master.zip
sudo mv scanserv-master/ scanserv
```
Ideally you should limit access to these directories like this...
```
sudo chown -R root:www-data /var/www/html/scanserv/output/
sudo chown -R root:www-data /var/www/html/scanserv/preview/
```
And set write permissions - the web site needs to create image files in these directories
```
sudo chmod 775 /var/www/html/scanserv/output/
sudo chmod 775 /var/www/html/scanserv/preview/
```
Now configure scanserv to point at the binaries

```
sudo nano /var/www/html/scanserv/classes_php/Config.php
```
    * Change /opt/bin/scanimage to /usr/bin/scanimage
    * Change /opt/bin/convert to /usr/bin/convert

Edit anything else you think is interesting, though the other defaults should be okay.

## References
 * http://forum.qnap.com/viewtopic.php?f=182&t=8351
 * http://sourceforge.net/p/phpsane/wiki/FreeBSD/

## Install on Arch Linux


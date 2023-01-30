# Troubleshooting

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

```
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
```
SUBSYSTEMS=="usb",KERNELS=="1-1.1",DRIVERS=="usb",ATTRS{idProduct}=="0827", ATTRS{idVendor}=="04b8", ATTRS{serial}=="L53010612130846360",SYMLINK+="%s{manufacturer}_printer",TAG+="systemd",RUN+="/bin/bash -c '/usr/bin/systemctl restart container-scanservjs.service &'"
```

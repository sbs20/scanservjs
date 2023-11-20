# SANE, imagemagick, scanners

## Gettings started

There is a reasonable chance that your scanner will just work out of the box.
But it's far from certain. Given you're reading this and, at the very least,
thinking about installing something in Linux, there's a good chance you're half
expecting this.

Old scanners tend to have built in support within SANE. Modern scanners tend to
be driverless and will have built in support with airscan. But there are
in-between scanners, often from HP or Brother, that require proprietary drivers.

Sometimes the easiest way to find out what you need is just install everything
and then troubleshoot.

## Defining network scanners

If you have a non-network, wired device (e.g. USB) then, if you have the luxury,
SANE over network is a great option. It enables devices (e.g. my old Canon
CanoScan LiDE 20) to be available to SANE anywhere on the network. This is
especially useful to me since I host the scanner in one place and can install
`scanservjs` in many places across many operating systems and dockers for
testing.

It effectively allows you to proxy a SANE backend (on the server). This is an
advantage because it means you only have to enable hardware access, with `udev`
and permissions in one place - it is especially helpful with docker, which is
not really meant to have host access.

[SANE over Network](https://wiki.debian.org/SaneOverNetwork)

```
[Scanner]
    <-(USB)->
        [Server Host]
            <-(saned.socket)->
                [Client Host]
                    <-(SANE)->
                        [scanimage]
                             <-(CLI)->
                                 [scanservjs]
```

### Configuring the server

All you need is to define the subnets to which you want to grant access in
`saned.conf`. Of course "All" is doing a lot of work here and assumes you know
about subnets and CIDR notation.

`/etc/sane.d/saned.conf`
```sh
# This is equivalent to 192.168.0.0/255.255.255.0
192.168.0.0/24

# Equivalent to 10.0.0.0/255.255.0.0
10.0.0.0/16

# Equivalent to 172.0.0.0/255.240.0.0 - useful for docker
172.16.0.0/12
```

Make your changes to the file and restart the saned socket.

```sh
## Local network
sudo echo "192.168.0.0/24" >> /etc/sane.d/saned.conf
## Default docker network
sudo echo "172.17.0.0/16" >> /etc/sane.d/saned.conf

sudo systemctl enable saned.socket
sudo systemctl start saned.socket
```

### Configuring the client

Add the server host (let's assume it is `192.168.0.10`) to the client.

```sh
sudo echo "192.168.0.10" >> /etc/sane.d/net.conf
```

Now if you run `scanimage -L` on the client you should see the scanner on the
host (prefixed with `net:192.168.0.10:`):

```
device `net:192.168.0.10:plustek:libusb:001:003' is a Canon CanoScan N670U/N676U/LiDE20 flatbed scanner
```

For more information on configuring the server and client see
[SANE over Network](https://wiki.debian.org/SaneOverNetwork#Server_Configuration).

It's worth noting that network scanners do not always show up on the client. In
such cases you will need to get the device name from the host, prefix it with
`net:$ip:` and use the `-d` switch. From the scanimage manpage:

From [`man scanimage`](https://linux.die.net/man/1/scanimage):

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

[sane-airscan](https://github.com/alexpevzner/sane-airscan) is useful for
supporting newer eSCL and WSD devices. Once installed you should just find that
it works with a simple `scanimage -L`. You can also specify a specific name for
the device in `/etc/sane.d/airscan.conf`

```ini
[devices]
"My scanner" = "http://10.0.111.4/eSCL"
```

Your URI will be different. You shouldn't need to do that though.

Airscan relies on bonjour to make it work - which means broadcasting to the
local subnet to autodiscover the device. If you are running on a different
subnet, the autodiscovery won't work. You have two options:

1. Use avahi reflector which "just" reflects broadcasts across the subnets
   ```sh
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
   //config.devices.push('net:${bridge}:${device}');
   config.devices.push('net:10.0.100.171:airscan:e0:Canon TR8500 series-5');
   ```

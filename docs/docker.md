# Running scanservjs under docker

If you're already running Debian, Ubuntu or similar, and haven't used docker
before then it's probably easier just to install directly. For what it's worth,
that is my preferred installation method.

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

Depending on your setup you have a number of options:

* If your scanner is **connected by USB to the host**, and there are standard
  SANE drivers, then you can map the device. The best way to do this is to map
  the actual USB ports.
  * Run `sudo sane-find-scanner -q` and you will get a result like
    `found USB scanner (vendor=0x04a9 [Canon], product=0x220d [CanoScan], chip=LM9832/3) at libusb:001:003`.
  * Or run `lsusb` which gives you
    `Bus 001 Device 003: ID 04a9:220d Canon, Inc. CanoScan N670U/N676U/LiDE 20`.
  * Both translate to `/dev/bus/usb/001/003`.
  * The docker argument would be
    `--device=/dev/bus/usb/001/003:/dev/bus/usb/001/003`
  * You may also need to adjust permissions on the USB port of the host e.g.
    `chmod a+rw dev/bus/usb/001/003` - see
    [this](https://github.com/sbs20/scanservjs/issues/221#issuecomment-828757430)
    helpful answer for more.

* If your scanner is **driverless over the network**, then
  [sane-airscan](https://github.com/alexpevzner/sane-airscan) should be able to
  figure it out - but it uses Avahi / Zeroconf / Bonjour to discover devices on
  the local network. You will want to share dbus to make it work
  (`-v /var/run/dbus:/var/run/dbus`).

* If your container is **running inside a VM** you may find that the USB device
  id is [unstable](https://github.com/sbs20/scanservjs/issues/66) and changes
  between boots. In these cases, you will probably find it easier to share the
  scanner over the network on the host.

* If you need **proprietary drivers** for your scanner then the best solution is
  either to install the drivers on the host and share it over the network or to
  create your own docker image based on the scanservjs one and add it in that
  way.

  Here is an example on how one particular Brother scanner model and its driver
  can be installed in the Dockerfile. The driver (`brscan4-0.4.10-1.amd64.deb`)
  needs to be placed next to the Dockerfile, then:
  ```dockerfile
  COPY brscan4-0.4.10-1.amd64.deb "$APP_DIR/brscan4-0.4.10-1.amd64.deb"
  RUN apt install -yq "$APP_DIR/brscan4-0.4.10-1.amd64.deb" \
  && brsaneconfig4 -a name=ADS-2600W model=ADS-2600W nodename=10.0.100.30
  ```
  Note: The addition of more backends to the docker container is not planned
  since it would mostly add cruft for most users who don't need it.

* Driverless-mode scanning (using airscan over IPP-USB) seems to result in
  problems. If anyone has ideas why (perhaps something additional needs sharing
  from host to guest) then suggestions are welcome.
  
* The best fallback position for most cases is simply to
  [share the host scanner over the network](https://github.com/sbs20/scanservjs/blob/master/docs/sane.md#configuring-the-server)
  on the host (where the scanner is connected) and then set the
  `SANED_NET_HOSTS`
  [environment variable](https://github.com/sbs20/scanservjs/blob/master/docs/docker.md#environment-variables)
  on the docker container.
  [This](https://github.com/sbs20/scanservjs/issues/129#issuecomment-800226184)
  user uses docker compose instead. See examples below.

## Mapping volumes

To access data from outside the docker container, there are two volumes you may
wish to map:

* The scanned images: use `-v /local/path/scans:/app/data/output`
* Configuration overrides: use `-v /local/path/cfg:/app/config`

### User and group mapping

When mapping volumes, special attention must be paid to users and file systems
permissions.

The docker container runs under a non-privileged user with a UID and GID of
`2001`. scanservjs relies on this user for editing SANE and airscan
configurations inside the container. Changing this user's UID (e.g. by using
`-u 1000` for `docker run`) to access scans/configuration from outside docker
**is not advised since it will cause these steps to fail.**

Your alternatives are:
1. changing the group of the container to a known group on the host e.g.
   `-u 2001:1000`. This will keep the user correct (`2001`) but change the group
   (`1000`).
2. creating a corresponding user on the host e.g.
   `useradd -u 2001 -ms /bin/bash scanservjs`
3. building a docker image with a custom UID/GID pairing: clone this repository
   and run
   `docker build --build-arg UID=1234 --build-arg GID=5678 -t scanservjs_custom .`
   (with UID and GID adjusted to your liking), then run the custom image (e.g.
   `docker run scanservjs_custom`).
4. as a last resort, changing the host volume permissions e.g.
   `chmod 777 local-volume`

## Environment variables

* `SANED_NET_HOSTS`: If you want to use a
  [SaneOverNetwork](https://wiki.debian.org/SaneOverNetwork#Server_Configuration)
  scanner then to perform the equivalent of adding hosts to
  `/etc/sane.d/net.conf` specify a list of ip addresses separated by semicolons
  in the `SANED_NET_HOSTS` environment variable.
* `AIRSCAN_DEVICES`: If you want to specifically add `sane-airscan` devices to
  your `/etc/sane.d/airscan.conf` then use the `AIRSCAN_DEVICES` environment
  variable (semicolon delimited).
* `DELIMITER`: if you need to include semi-colons (`;`) in your environment
  variables, this allows you to choose an alternative delimiter.
* `DEVICES`: Force add devices use `DEVICES` (semicolon delimited)
* `SCANIMAGE_LIST_IGNORE`: To force ignore `scanimage -L`

## Examples

### Connect to the scanner over the network (recommended)
```sh
docker run -d -p 8080:8080 \
  -e SANED_NET_HOSTS="10.0.100.30" \
  --name scanservjs-container sbs20/scanservjs:latest
```

### Mapped USB device with mapped volumes

```sh
docker run -d -p 8080:8080 \
  -v $HOME/scan-data:/app/data/output \
  -v $HOME/scan-cfg:/app/config \
  --device /dev/bus/usb/001/003:/dev/bus/usb/001/003 \
  --name scanservjs-container sbs20/scanservjs:latest
```

### Use airscan and a locally detected scanner

This should support most use cases

```sh
docker run -d -p 8080:8080 \
  -v /var/run/dbus:/var/run/dbus \
  --name scanservjs-container sbs20/scanservjs:latest
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
  --name scanservjs-container --privileged sbs20/scanservjs:latest
```

### Hosting it on a Synology NAS using Docker

It can be convenient to host scanservjs on the same machine where you store your
scans — your NAS. Here's a possible approach for network scanning with a
Synology NAS:

1. Install the
   [Synology Docker package](https://www.synology.com/en-us/dsm/packages/Docker).
2. In DSM, create a service user "scanservjs" which will run the Docker
   container. Make sure to give it write permission to the preferred target
   location for scans. We'll use `/volume1/scans`.
3. SSH with an admin account onto the NAS and use `id` to determine the UID and
   GID of the service user just created:
    ```sh
    admin@synology:~$ id scanservjs
    uid=1034(scanservjs) gid=100(users) groups=100(users),65538(scanusers)
    ```
   Keep the session open, we'll need it again in a moment.
4. On your workstation, download and extract
   [the latest scanservjs release](https://github.com/sbs20/scanservjs/releases/latest).
5. In the repository root, create a text file named `docker-compose.yml` with
   the following content:
    ```yaml
    version: "3"
    services:
      scanservjs:
        build:
          context: .
          args:
            # ----- enter UID and GID here -----
            UID: 1034
            GID: 100
        container_name: scanservjs
        environment:
          # ----- specify network scanners here; see above for more possibilities -----
          - SANED_NET_HOSTS="10.0.100.30"
        volumes:
          # ---- enter your target location for scans before the ':' character -----
          - /volume1/scans:/app/data/output
          - ./config:/app/config
        ports:
          - 8080:8080
        restart: unless-stopped
    ```
6. Copy the entire repository including `docker-compose.yml` onto your NAS (via
   smb, sftp, ...).
7. In your SSH session from earlier, `cd` to the repository location and run
    ```sh
    sudo docker-compose up -d
    ```
8. After a medium-sized cup of tea, scanservjs should be available at
   `http://<NAS IP Address>:8080`
9. Bonus: Create a reverse proxy rule in the
   [Application Portal](https://www.synology.com/en-global/knowledgebase/DSM/help/DSM/AdminCenter/application_appportalias)
   so that scanservjs can be reached via `http://scan.synology.lan` (or
   similar). Scanning can be slow, so set the proxy timeouts to 300 seconds or
   more [to prevent timeout issues](troubleshooting.md).

## Staging builds

These may be less stable, but also have upcoming features.

If you want to install the latest staging branch (this may contain newer code)

```sh
docker pull sbs20/scanservjs:staging
docker rm --force scanservjs-container 2> /dev/null
docker run -d -p 8080:8080 -v /var/run/dbus:/var/run/dbus --restart unless-stopped --name scanservjs-container --privileged sbs20/scanservjs:staging
```

# Running scanservjs under docker

If you're already running Debian, Ubuntu or similar, and haven't used docker
before then it's probably easier just to install directly. For what it's worth,
that is my preferred installation method since Docker takes an already
complicated situation and makes it more complicated.

## Getting started

Get the image and run:

```sh
# Get the latest
docker pull sbs20/scanservjs:latest

# Remove old container
docker rm --force scanservjs-container 2> /dev/null

# Run
docker run \
  --detach \
  --publish 8080:8080 \
  --volume /var/run/dbus:/var/run/dbus \
  --restart unless-stopped \
  --name scanservjs-container \
  --privileged \
  sbs20/scanservjs:latest
```

## General notes

:warning: By default, configuration and scanned images are stored within the
container and will be lost if you recreate it. If you want to map your scanned
images then see mapping section below

✅ The docker image supports arm as well as amd64.

## Accessing hardware

Docker is great for certain tasks. But it's less ideal for situations where the
container needs to access the host hardware. The simple solution is to run with
`--privileged` but that gives your container full root access to the host which
means you're putting a lot of trust in the container and it's often still not
sufficient for a working system. It's better not to do this, but it can be
painful to avoid. The cleanest solution is to use
[SANE over Network](./03-sane.md#defining-network-scanners).

## Using SANE over Network

The best overall implementation with Docker if you can manage it is to
[share the scanner over the network](./03-sane.md#configuring-the-server) on the
host (where the scanner is connected) and then update `net.conf` in the
container; either using a volume map or setting the `SANED_NET_HOSTS`
[environment variable](#environment-variables) on the docker container.

[This](https://github.com/sbs20/scanservjs/issues/129#issuecomment-800226184)
user uses docker compose instead. See examples below.

## Configuring SANE

Sometimes you will need to configure SANE within the container. The best way to
achieve this is just volume mapping.

Example to [configure `airscan.conf`](https://github.com/sbs20/scanservjs/issues/628):

```sh
# Create your airscan config
cat > ./airscan.host.conf << EOF
[devices]
HP = http://192.168.1.150/eSCL, eSCL

[options]
discovery = disable
EOF

# Now map it
docker run -d \
  --publish 8080:8080 \
  --volume ./airscan.host.conf:/etc/sane.d/airscan.conf \
  --restart unless-stopped \
  --name scanservjs-container \
  --privileged \
  sbs20/scanservjs:latest
```

Example to [configure `pixma.conf`](https://github.com/sbs20/scanservjs/issues/594):

```sh
# Create your pixma config
echo "bjnp://192.168.1.5" > ./pixma.host.conf

# Now map it
docker run -d \
  --publish 8080:8080 \
  --volume ./pixma.host.conf:/etc/sane.d/pixma.conf \
  --restart unless-stopped \
  --name scanservjs-container \
  --privileged \
  sbs20/scanservjs:latest
```

## Environment variables

There are some shortcuts available to volume mapping above by using environment
variables:

* `SANED_NET_HOSTS`: If you want to use a
  [SaneOverNetwork](https://wiki.debian.org/SaneOverNetwork#Server_Configuration)
  scanner then to perform the equivalent of adding hosts to
  `/etc/sane.d/net.conf` specify a list of ip addresses separated by semicolons
  in the `SANED_NET_HOSTS` environment variable.
* `AIRSCAN_DEVICES`: If you want to specifically add `sane-airscan` devices to
  your `/etc/sane.d/airscan.conf` then use the `AIRSCAN_DEVICES` environment
  variable (semicolon delimited).
* `PIXMA_HOSTS`: If you want to use a PIXMA scanner which uses the bjnp protocol
  then to perform the equivalent of adding hosts to `/etc/sane.d/pixma.conf`
  specify a list of ip addresses separated by semicolons in the `PIXMA_HOSTS`
  environment variable.
* `DELIMITER`: if you need to include semi-colons (`;`) in your environment
  variables, this allows you to choose an alternative delimiter.
* `DEVICES`: Force add devices use `DEVICES` (semicolon delimited)
* `SCANIMAGE_LIST_IGNORE`: To force ignore `scanimage -L`

## Mapping volumes

To access data from outside the docker container, there are two volumes you may
wish to map:

* The scanned images: use `--volume /local/path/scans:/var/lib/scanservjs/output`
* Configuration overrides: use `--volume /local/path/cfg:/etc/scanservjs`

## Host attached scanner

If your scanner is connected by USB to the host, and there are standard SANE
drivers, then you can map the device. The best way to do this is to map the
actual USB ports.

In case you scanner is always plugged to your device:

* Run `sudo sane-find-scanner -q` and you will get a result like
  ```
  found USB scanner (vendor=0x04a9 [Canon], product=0x220d [CanoScan], chip=LM9832/3) at libusb:001:003
  ```
* Or run `lsusb` which gives you
  ```
  Bus 001 Device 003: ID 04a9:220d Canon, Inc. CanoScan N670U/N676U/LiDE 20
  ```
* Both translate to `/dev/bus/usb/001/003`.
* The docker argument would be
  `--device=/dev/bus/usb/001/003:/dev/bus/usb/001/003`
* You may also need to adjust permissions on the USB port of the host e.g.
  ```sh
  chmod a+rw dev/bus/usb/001/003
  ```
  See
  [this](https://github.com/sbs20/scanservjs/issues/221#issuecomment-828757430)
  helpful answer for more.

## Ephemeral bus address

In case your scanner is not always plugged in, the device path will change
every so often, and the previous solution will stop working. Also, some devices
will go to sleep after long idle times, effectively getting "unplugged" and
"plugged again" over and over.

This can also happen if your container is running inside a VM resultig in an
[unstable device id](https://github.com/sbs20/scanservjs/issues/66).

In this case, you may use `udev` so that it starts or re-configures your
container whenever your scanner is hot-plugged. This is suggested in
[the official Docker documentation](https://docs.docker.com/engine/reference/commandline/run/#device-cgroup-rule):

* Run `lsusb` to retrieve your device "vendor ID" and "product ID". Reusing the
  example above:
  ```
  Bus 001 Device 003: ID 04a9:220d Canon, Inc. CanoScan N670U/N676U/LiDE 20
  ```
  means that the vendor ID is `04a9`, and the product ID is `220d`.
* Add a udev rule

  `/etc/udev/rules.d/50-add-scanner.rules`
  ```ini
  ACTION=="add", ATTR{idVendor}=="04a9", ATTR{idProduct}=="1774", RUN+="/etc/scan/bind-scanner-to-container.sh $name $major $minor $attr{idVendor} $attr{idProduct}"
  ```
* Make `udev` aware of this change:
  ```sh
  sudo udevadm control --reload-rules
  ```
* This will run the following script every time the scanner is plugged.

  `/etc/scan/bind-scanner-to-container.sh`
  ```sh
  #!/bin/bash
  # This script must be executable by root
  DEVICE_PATH="$1"
  MAJOR_NUMBER="$2"
  MINOR_NUMBER="$3"

  # USB identifiers of the device
  VENDOR_ID="$4"
  PRODUCT_ID="$5"

  CONTAINER_NAME="scan"
  IMAGE_NAME="sbs20/scanservjs:release-v2.25.0"

  logger "Scanner ($VENDOR_ID:$PRODUCT_ID) is available at $DEVICE_PATH. Let's make it available to the scan server container"

  # Is the container running already?
  container_id=$(docker ps -q -f name=$CONTAINER_NAME)
  if [ -z "$container_id" ]; then
    # Container was not running. We should start it, with the right device ID
    device_nb=$(lsusb | grep "$VENDOR_ID:$PRODUCT_ID" | grep -o -E "Device [0-9]+" | grep -o -E "[0-9]+")

    if [ -z "$device_nb" ]; then
      logger "Unable to find where this device is connected. Ignoring."
      exit 1
    fi

    # Waiting for Docker to be available (if the scanner is plugged when the host boots, udev will trigger this script before Docker is even started)
    attempts=0
    while true ; do
      if [ "$(systemctl is-active docker)" == "active" ]; then
        break
      fi
      sleep 10
      attempts=$(( attempts + 1 ))
      if [ "$attempts" -gt 10 ]; then
        logger "Docker is not running. Will not start scan server."
        exit 1
      fi
    done

    logger "Starting the scan server from $IMAGE_NAME, with device $device_nb ($VENDOR_ID:$PRODUCT_ID, major number is $MAJOR_NUMBER)..."
    # --device adds the existing device to the container.
    # --device-cgroup-rule makes it possible to add future hot-plugged devices
    # see https://docs.docker.com/engine/reference/commandline/run/#device-cgroup-rule
    docker run --detach \
      --rm \
      --publish 8080:8080 \
      --volume /var/run/dbus:/var/run/dbus \
      --volume /path/to/the/optional/scan/folder:/var/lib/scanservjs/output \
      --volume /path/to/the/optional/custom/config:/etc/scanservjs \
      --name "$CONTAINER_NAME" \
      --device=/dev/bus/usb/001/"$device_nb":/dev/bus/usb/001/"$device_nb" \
      --device-cgroup-rule="c $MAJOR_NUMBER:* rmw" \
      "$IMAGE_NAME" 2>&1 | logger
  else
    # Container is running. We just have to add the device there
    logger "Adding the new scanner to the scan server container..."
    docker exec "$CONTAINER_NAME" mknod "/dev/$DEVICE_PATH" c "$MAJOR_NUMBER" "$MINOR_NUMBER" 2>&1 | logger
  fi
  ```
* If you prefer, you may tweak both files above e.g. to stop the container
  when the scanner is disconnected, and re-start the container when the
  device is re-connected.

## Driverless over the network

If your scanner is driverless over the network, then
[sane-airscan](https://github.com/alexpevzner/sane-airscan) should be able to
figure it out - but it uses Avahi / Zeroconf / Bonjour to discover devices on
the local network. You will want to share dbus to make it work
(`--volume /var/run/dbus:/var/run/dbus`).

Note that driverless-mode scanning (using airscan over IPP-USB) often results in
problems. If anyone has ideas why (perhaps something additional needs sharing
from host to guest) then suggestions are welcome.
[The documentation](https://wiki.debian.org/SaneOverNetwork#Sharing_on_Debian_11_.28bullseye.29_and_later)
may be useful.

## Proprietary drivers

If you need **proprietary drivers** for your scanner then the best solution is
either to install the drivers on the host and share it over the network or to
create your own docker image based on the scanservjs one and add it in that way.

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

## User and group mapping

When mapping volumes, special attention must be paid to users and file systems
permissions.

The docker container runs as root by default. Changing the user's UID (e.g. by
using `--user 1000` for `docker run`) to access scans/configuration from outside
docker **is not advised since it will cause scans to fail.**. If running as a
different user is important to you then see the `scanservjs-user2001` target in
[../Dockerfile](../Dockerfile).

Your alternatives are:

1. changing the group of the container to a known group on the host e.g.
   `--user 0:1000`. This will keep the user correct (`0`) but change the group
   (`1000`).
2. building a docker image with a custom UID/GID pairing: clone this repository
   and run
   ```sh
   docker build --build-arg UID=1234 --build-arg GID=5678 --tag scanservjs_custom .
   ```
   (with UID and GID adjusted to your liking), then run the custom image (e.g.
   `docker run scanservjs_custom`).
3. as a last resort, changing the host volume permissions e.g.
   `chmod 777 local-volume`

## Examples

### Connect to the scanner over the network (recommended)
```sh
docker run --detach --publish 8080:8080 \
  --env SANED_NET_HOSTS="10.0.100.30" \
  --name scanservjs-container sbs20/scanservjs:latest
```

### Mapped USB device with mapped volumes

```sh
docker run --detach --publish 8080:8080 \
  --volume $HOME/scan-data:/var/lib/scanservjs/output \
  --volume $HOME/scan-cfg:/etc/scanservjs \
  --device /dev/bus/usb/001/003:/dev/bus/usb/001/003 \
  --name scanservjs-container sbs20/scanservjs:latest
```

### Use airscan and a locally detected scanner

This should support most use cases

```sh
docker run --detach --publish 8080:8080 \
  --volume /var/run/dbus:/var/run/dbus \
  --name scanservjs-container sbs20/scanservjs:latest
```

### A bit of everything

Add two net hosts to sane, use airscan to connect to two remote scanners, add
two pixma scanners using the bjnp protocol, don't use `scanimage -L`, force a
list of devices, override the OCR language and run in privileged mode

```sh
docker run --detach --publish 8080:8080 \
  --env SANED_NET_HOSTS="10.0.100.30;10.0.100.31" \
  --env AIRSCAN_DEVICES='"Canon MFD" = "http://192.168.0.10/eSCL";"EPSON MFD" = "http://192.168.0.11/eSCL"' \
  --env PIXMA_HOSTS="10.0.100.32;10.0.100.33" \
  --env SCANIMAGE_LIST_IGNORE=true \
  --env DEVICES="net:10.0.100.30:plustek:libusb:001:003;net:10.0.100.31:plustek:libusb:001:003;airscan:e0:Canon TR8500 series;airscan:e1:EPSON Cool Series" \
  --env OCR_LANG="fra" \
  --volume /var/run/dbus:/var/run/dbus \
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
          target: scanservjs-user2001
        container_name: scanservjs
        environment:
          # ----- specify network scanners here; see above for more possibilities -----
          - SANED_NET_HOSTS="10.0.100.30"
        volumes:
          # ---- enter your target location for scans before the ':' character -----
          - /volume1/scans:/var/lib/scanservjs/output
          - ./config:/etc/scanservjs
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
docker run \
  --detach \
  --publish 8080:8080 \
  --volume /var/run/dbus:/var/run/dbus \
  --restart unless-stopped \
  --name scanservjs-container \
  --privileged sbs20/scanservjs:staging
```

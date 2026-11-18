#!/bin/sh
set -xve

# Test using the following form:
# export SANED_NET_HOSTS="a|b" AIRSCAN_DEVICES="c|d" DELIMITER="|"; ./entrypoint.sh

# turn off globbing
set -f

# split at newlines only (airscan devices can have spaces in)
IFS='
'

# Get a custom delimiter but default to ;
DELIMITER=${DELIMITER:-;}

# Insert a list of net hosts
if [ ! -z "$SANED_NET_HOSTS" ]; then
  hosts=$(echo $SANED_NET_HOSTS | sed "s/$DELIMITER/\n/g")
  for host in $hosts; do
    echo $host >> /etc/sane.d/net.conf
  done
fi

# Insert airscan devices
if [ ! -z "$AIRSCAN_DEVICES" ]; then
  devices=$(echo $AIRSCAN_DEVICES | sed "s/$DELIMITER/\n/g")
  for device in $devices; do
    sed -i "/^\[devices\]/a $device" /etc/sane.d/airscan.conf
  done
fi

# Insert pixma hosts
if [ ! -z "$PIXMA_HOSTS" ]; then
  hosts=$(echo $PIXMA_HOSTS | sed "s/$DELIMITER/\n/g")
  for host in $hosts; do
    # Plain hosts default to bjnp://. Full URLs (e.g. mfnp://host for
    # imageCLASS/i-SENSYS devices, or bjnp://host:port/timeout=...) are
    # written as given.
    case "$host" in
      *://*) echo "$host" >> /etc/sane.d/pixma.conf ;;
      *) echo "bjnp://$host" >> /etc/sane.d/pixma.conf ;;
    esac
  done
fi

unset IFS
set +f

node ./server/server.js

#!/bin/sh
set -xve

# turn off globbing
set -f

# split at newlines only (airscan devices can have spaces in)
IFS='
'

# Insert a list of net hosts
if [ ! -z "$SANED_NET_HOSTS" ]; then
  hosts=$(echo $SANED_NET_HOSTS | sed "s/;/\n/")
  for host in $hosts; do
    echo $host >> /etc/sane.d/net.conf
  done
fi

# Insert airscan devices
if [ ! -z "$AIRSCAN_DEVICES" ]; then
  devices=$(echo $AIRSCAN_DEVICES | sed "s/;/\n/")
  for device in $devices; do
    sed -i "/^\[devices\]/a $device" /etc/sane.d/airscan.conf
  done
fi

unset IFS
set +f

node ./server/server.js


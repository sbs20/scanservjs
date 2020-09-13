#!/bin/sh
set -xve
[ ! -z "$NET_HOST" ] && echo $NET_HOST > /etc/sane.d/net.conf
node ./server/Server.js


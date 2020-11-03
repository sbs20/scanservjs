#!/bin/sh

# Check we have the necessary privileges
ROOTUID="0"
if [ "$(id -u)" -ne "$ROOTUID" ] ; then
    echo "Error: This script must be executed with root privileges. Try sudo."
    exit 1
fi

scansrvjs_home=/var/www/scanservjs

# Stop and dsiable service
systemctl stop scanservjs
systemctl disable scanservjs

# Remove service definition and reload
rm /etc/systemd/system/scanservjs.service
systemctl daemon-reload

# Remove all files
rm -r $scansrvjs_home

# Remove user
userdel -r scanservjs

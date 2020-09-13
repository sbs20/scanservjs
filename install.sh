#!/bin/sh

# This script assumes you have already downloaded (or built) a 
# *release* version of scanservjs. To download go to
# https://github.com/sbs20/scanservjs/releases/latest and get the latest file

# Check we have the necessary privileges
ROOTUID="0"
if [ "$(id -u)" -ne "$ROOTUID" ] ; then
    echo "Error: This script must be executed with root privileges. Try sudo."
    exit 1
fi

# Check dependencies
if ! [ -x "$(command -v node)" ]; then
    echo 'Error: nodejs is not installed.' >&2
    exit 1
fi

if ! [ -x "$(command -v npm)" ]; then
    echo 'Error: npm is not installed.' >&2
    exit 1
fi

# Set correct src dir
srcdir="$( cd "$( dirname "$0" )" && pwd )"

# Set up variables here
scansrvjs_home=/var/www/scanservjs
scanservjs_status=`systemctl is-active scanservjs 2>&1 | tr -s \\n`
scanservjs_user_exists=`grep scanservjs /etc/passwd 2>&1 | tr -s \\n`

# If this is not the first time you've installed this on a device
# then stop the service first
if [ "$scanservjs_status" = "active" ]; then
    systemctl stop scanservjs
fi

# Completely wipe any previous install
rm -rf $scansrvjs_home

# You need to install SANE first
# See: https://github.com/sbs20/scanserv/blob/master/install-sane.md
if [ -z "$scanservjs_user_exists" ]; then
    # Create a user for this service and set primary group to "users"
    useradd -m -g users scanservjs

    # Add the new user to the scanner group too (created by SANE)
    usermod -aG scanner scanservjs
fi

# Create a target directory for the website
mkdir -p $scansrvjs_home

# Download and copy to target location
cp -rf $srcdir/* $scansrvjs_home

# Set the file owners
chown -R scanservjs:users $scansrvjs_home/

# Update directory permissions so we can look inside
find . -type d -exec chmod 755 {} +

# ... and ensure the server is executable
chmod +x $scansrvjs_home/server/Server.js

# Enable PDF
sed -i 's/policy domain="coder" rights="none" pattern="PDF"/policy domain="coder" rights="read | write" pattern="PDF"'/ /etc/ImageMagick-6/policy.xml

# Change to the target location
cd $scansrvjs_home

# Install all the node dependencies
npm install --only=production

# Now copy the service definition
cp scanservjs.service /etc/systemd/system

# Reload the deamon info
systemctl daemon-reload

# Start the new service
systemctl start scanservjs

echo "scanservjs starting"
echo "http://127.0.0.1:8080"
echo
echo "If you have problems, try 'journalctl -xe'"

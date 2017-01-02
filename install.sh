
srcdir="$( cd "$( dirname "$0" )" && pwd )"
scansrvjs_home=/var/www/scanservjs
scanservjs_status=`systemctl is-active scanservjs 2>&1 | tr -s \\n`
scanservjs_user_exists=`grep scanservjs /etc/passwd 2>&1 | tr -s \\n`

# If this is not the first time you've installed this on a device
# then stop the service first

if [ "$scanservjs_status" = "active" ]; then
systemctl stop scanservjs
fi

# And if you want to completely wipe any previous install then...
rm -r $scansrvjs_home

# You need to install SANE first
# See: https://github.com/sbs20/scanserv/blob/master/install-sane.md

if [ -z "$scanservjs_user_exists" ]; then
# Create a user for this service
useradd -m scanservjs
# Add the new user to the scanner group
usermod -G scanner scanservjs
fi

# Create a target directory for the website
mkdir -p $scansrvjs_home

# Download and copy to target location
cp -rf $srcdir/* $scansrvjs_home

# Set the owner
chown -R scanservjs:scanservjs $scansrvjs_home/

# ... and ensure the server is executable
chmod +x $scansrvjs_home/server.js

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

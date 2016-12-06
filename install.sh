# systemctl stop scanservjs
# rm -r /var/www/scanservjs

# You need to install SANE first
# See: https://github.com/sbs20/scanserv/blob/master/install-sane.md

# Create a user for this service
useradd -m scanservjs

# Add the user to the scanner group
sudo usermod -G scanner scanservhttpd

# Create a target directory for the website
mkdir -p /var/www/scanservjs

# Download and copy to target location
# cp -rf /mnt/storage/public/scanjs/* /var/www/scanservjs

# Set the owner
chown -R scanservjs:users /var/www/scanservjs/

# ... and ensure the server is executable
chmod +x /var/www/scanservjs/server.js

# Change to the target location
cd /var/www/scanservjs

# Install all the node dependencies
npm install --only=production

# Now copy the service definittion
cp scanservjs.service /etc/systemd/system

# Reload the deamon info
systemctl daemon-reload

# Start the new service
systemctl start scanservjs
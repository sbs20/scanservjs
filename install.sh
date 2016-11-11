systemctl stop scanservjs
rm -r /var/www/scanservjs
mkdir -p /var/www/scanservjs
cp -rf /mnt/storage/public/scanjs/* /var/www/scanservjs
chown -R scanservjs:users /var/www/scanservjs/
chmod +x /var/www/scanservjs/server.js
cd /var/www/scanservjs
npm install
cp scanservjs.service /etc/systemd/system
systemctl daemon-reload
systemctl start scanservjs
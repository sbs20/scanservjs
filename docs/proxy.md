## Reverse proxy

scanservjs supports reverse proxying and uses relative paths throughout so no
URL rewriting should be required.

### Apache

Example setup using a debian based distro.

```sh
sudo apt install apache2
sudo a2enmod proxy
sudo a2enmod proxy_http
sudo nano /etc/apache2/sites-available/000-default.conf
```

Then add the following to a virtual host:

```
<Location /scanner/>
  ProxyPass "http://127.0.0.1:8080/"
  ProxyPassReverse "http://127.0.0.1:8080/"
</Location>
```

And restart

```sh
sudo systemctl restart apache2
```

## nginx

```sh
sudo apt install nginx
```

Edit your settings (e.g. `sudo nano /etc/nginx/sites-available/default`)

And add the following inside your chosen server block

```
  # Increase timeouts since scan operations can take some time
  proxy_read_timeout 300;
  proxy_connect_timeout 300;
  proxy_send_timeout 300;

  location /scanner/ {
    proxy_set_header   X-Real-IP $remote_addr;
    proxy_pass         http://127.0.0.1:8080/;
  }
```

Restart

```sh
sudo systemctl restart nginx
```

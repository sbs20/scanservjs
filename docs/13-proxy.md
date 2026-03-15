# Reverse proxy

scanservjs supports reverse proxying and uses relative paths throughout so no
URL rewriting should be required.

## Apache

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

## Cloudflare

scanservjs works behind Cloudflare's reverse proxy, but requires attention
when Cloudflare Access (Zero Trust) is also in front of it.

### Cloudflare Access: bypass PWA resource paths

The browser fetches PWA resources (manifest, service worker, icons) without
forwarding session cookies, so Cloudflare Access will redirect those requests
to its login page. The resulting cross-origin redirect causes a CORS error and
breaks PWA installation.

Fix: in the Cloudflare Zero Trust dashboard, create a **Bypass** policy rule
for the following path patterns under your application:

| Path pattern | Purpose |
|---|---|
| `/manifest.json*` | PWA web app manifest |
| `/service-worker.js` | PWA service worker |
| `/icons/*` | PWA icons |
| `/favicon.svg` | Favicon |

These resources contain no sensitive data and must be publicly reachable.
This is optional — without it, all scanning features work normally. Only
PWA installation fails, and CORS errors appear in the browser developer
console (invisible to regular users).

### Content Security Policy and the Cloudflare beacon

Cloudflare automatically injects an analytics beacon script
(`static.cloudflareinsights.com`) into HTML pages it proxies. scanservjs's
Content Security Policy already allows this script and its network connection
(`cloudflareinsights.com`), so no additional configuration is needed.

If you see a CSP violation for `static.cloudflareinsights.com` in the browser
console you are likely running an older build — updating to the latest release
resolves it.

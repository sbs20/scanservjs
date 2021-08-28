# Development

## Install and setup

```shell
# Install dependencies
sudo apt-get install curl nodejs npm imagemagick sane-utils tesseract-ocr

# Ideally set the npm version
sudo npm install npm@7.11.2 -g

# Enable PDF (required for execution and unit tests)
sudo sed -i 's/policy domain="coder" rights="none" pattern="PDF"/policy domain="coder" rights="read | write" pattern="PDF"'/ /etc/ImageMagick-6/policy.xml

# Clone the repo
git clone https://github.com/sbs20/scanservjs.git

# Install all packages
cd scanservjs && npm run install

# Run (from the scanservjs directory)
npm run serve
```

`npm run serve` will hook the development server into webpack (see
vue.config.js).

If you run into the following error, then you may need to increase your inotify
limit:

```
[nodemon] Internal watch failed: ENOSPC: System limit for number of file watchers reached, watch '/.../scanservjs/packages/server/src'
```

To incease it temporarily:

```
sudo sysctl fs.inotify.max_user_watches=131072
```

To update it permanently will depend on your distribution - but this will work
with Debian:

```
echo fs.inotify.max_user_watches=131072 | sudo tee -a /etc/sysctl.d/50-default.conf; sudo sysctl -p
```

## Build

Before committing please verify and build

```
npm run verify && npm run build
```

Alternatively, create a local release package

```
npm run release
```

## Updating node dependencies

* `npm audit fix` or `npm update`. This won't remove old packages; to do so,
  delete node_modules and reinstall

## References

* [Run server with webpack](https://dennisreimann.de/articles/vue-cli-serve-express.html)
* [i18n](https://www.codeandweb.com/babeledit/tutorials/how-to-translate-your-vue-app-with-vue-i18n)

## Docker

Install docker
```
sudo apt install docker.io
sudo systemctl unmask docker
sudo systemctl start docker

# Hack to make docker accessible.
sudo chmod 666 /var/run/docker.sock
```

Useful commands
```sh
# Build and run
docker build -t scanservjs-image .
docker rm --force scanservjs-container 2> /dev/null
docker run -d -p 8080:8080 -v /var/run/dbus:/var/run/dbus --name scanservjs-container --privileged scanservjs-image
docker run -d -p 8080:8080 -v $HOME/scan-data:/app/data/output --name scanservjs-container --privileged scanservjs-image

# Copy image
docker save -o scanservjs-image.tar scanservjs-image
docker load -i scanservjs-image.tar

# Shell inside image
docker run -it --entrypoint=/bin/bash scanservjs-image

# Shell inside running container
docker exec -it scanservjs-container /bin/bash

docker logs scanservjs-container

# Start and stop
docker container rm scanservjs-container
docker container start scanservjs-container
docker container stop scanservjs-container
docker container restart scanservjs-container

# Maintenance
docker ps -a
docker image prune
docker image rm -f $(docker image ls --filter dangling=true -q)

# Danger
docker image rm -f $(docker image ls -a -q)
```

## Mount map configuration files

```sh
docker run -d \
  -p 8080:8080 \
  -v `pwd`/var/:/app/config/ \
  --name scanservjs-container \
  --privileged \
  scanservjs-image
```
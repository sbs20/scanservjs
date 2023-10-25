# Development

## Install and setup

```shell
# Setup any nodejs requirements
# https://github.com/nodesource/distributions#installation-instructions
# curl -fsSL https://deb.nodesource.com/setup_18.x | bash -

# Install dependencies
sudo apt-get install curl nodejs npm imagemagick sane-utils tesseract-ocr

# Enable PDF (required for execution and unit tests)
sudo sed -i 's/policy domain="coder" rights="none" pattern="PDF"/policy domain="coder" rights="read | write" pattern="PDF"'/ /etc/ImageMagick-6/policy.xml

# Clone the repo
git clone https://github.com/sbs20/scanservjs.git

# Install all packages
cd scanservjs && npm install .

# Run (from the scanservjs directory)
npm run dev
```

`npm run dev` will simultanesouly run the server (see package.json and
vite.config.js).

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
npm run lint && npm run test && npm run build
```

## Find missing translations

```
npm run util:missing-translations
```

## References

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
# Build
docker build -t scanservjs-image .

# Build the core image
docker build --target scanservjs-core -t scanservjs-image .

# Remove any existing containers
docker rm --force scanservjs-container 2> /dev/null

# Different run options
docker run -d -p 8080:8080 --name scanservjs-container --privileged scanservjs-image
docker run -d -p 8080:8080 -e SANED_NET_HOSTS="10.0.100.30" --name scanservjs-container --privileged scanservjs-image
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
docker builder prune

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

## Using docker to build

You may wish to attempt building with a different version of node. There are
various ways to achieve this but Docker works well.

```Docker
# build.Dockerfile
FROM node:18-bookworm-slim AS scanservjs-build
ENV APP_DIR=/app
WORKDIR "$APP_DIR"

COPY package*.json build.js "$APP_DIR/"
COPY app-server/package*.json "$APP_DIR/app-server/"
COPY app-ui/package*.json "$APP_DIR/app-ui/"

RUN npm clean-install .

COPY app-server/ "$APP_DIR/app-server/"
COPY app-ui/ "$APP_DIR/app-ui/"

RUN npm run build

COPY makedeb.sh "$APP_DIR/"
RUN ./makedeb.sh
```

Run the dockerfile:

```sh
docker build --target release-node18 --file build.Dockerfile --tag scanservjs-release-node18 .
```

If you want, you can copy the files out again:

```sh
id=$(docker create scanservjs-release-node18)
docker cp $id:/app/debian ./
docker rm -v $id
```

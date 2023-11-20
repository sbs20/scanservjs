# Development

## Summary

* Development requires at least Node 16 in order to support the UI build.
* All code in `app-server` must be able to run under Node 10; no modern
  features.
* Any commit must pass the following;
  ```sh
  npm run lint && npm run test && npm run build && ./makedeb.sh
  ```

## Getting started

```shell
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

`npm run dev` will simultanesouly run the server (see
[package.json](../package.json) and
[vite.config.js](../app-ui/vite.config.js)).

If you run into the following error, then you may need to increase your inotify
limit:

```log
[nodemon] Internal watch failed: ENOSPC: System limit for number of file watchers reached, watch '/.../scanservjs/packages/server/src'
```

To incease it temporarily:

```sh
sudo sysctl fs.inotify.max_user_watches=131072
```

To update it permanently will depend on your distribution - but this will work
with Debian:

```sh
echo fs.inotify.max_user_watches=131072 | sudo tee -a /etc/sysctl.d/50-default.conf; sudo sysctl -p
```

## Build

Before committing please verify and build

```sh
npm run lint && npm run test && npm run build && ./makedeb.sh
```

## Find missing translations

```sh
npm run util:missing-translations
```

## Packaging

The installation is achieved with a debian binary package. The package is
created by `makedeb.sh`; doing so with a source package seemed too big a step.

The installation structure is:

```
/etc/scanservjs/ -> config directory
/usr/lib/scanservjs/ -> code
/var/lib/scanservjs/ -> runtime data directory
```

The `makdeb.sh` packager:

* Creates the directory structure
* Moves all build assets into the correct place
* Runs `npm clean-install`
* Creates symlinks so that the app can access config and runtime data
* Dynamically creates things like `control`, `preinst`, `postint`, `prerm`,
  `postrm` and the systemd service file.

The Docker build creates its own deb package which somewhat unifies the
installation process (and testing). Note that Docker containers do not typically
support systemd.

## Docker

Install docker
```sh
sudo apt install docker.io
sudo systemctl unmask docker
sudo systemctl start docker

# Hack to make docker accessible.
sudo chmod 666 /var/run/docker.sock
```

Useful commands
```sh
# Build
docker build --tag scanservjs-image .

# Build the core image
docker build --target scanservjs-core --tag scanservjs-image .

# Remove any existing containers
docker rm --force scanservjs-container 2> /dev/null

# Different run options
docker run -d -p 8080:8080 --name scanservjs-container --privileged scanservjs-image
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

```dockerfile
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

## Pages

```sh
# Install and setup
sudo apt-get install -y ruby-full
gem install bundler --user-install

# Run
bundle config set --local path ~/.gem
bundle install
bundle exec jekyll serve --incremental
```

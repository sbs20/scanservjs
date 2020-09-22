# Development

## Steps

* Install Node
* Clone the repo
* Navigate to the repo directory
* Windows:
  ```
  npm install -g @vue/cli @vue/cli-service-global gulp-cli
  npm install .
  ```
* Linux:
  ```
  sudo npm install -g @vue/cli @vue/cli-service-global gulp-cli
  npm install .
  ```

## Run
```
npm run serve
```

This will hook the server component into webpack (see vue.config.js) and
references below.

## Build

Convenience method which performs linting and builds the client and server
```
gulp
```

When docker builds it runs the following
```
npm run server-build
npm run client-build
```

or do a release:
```
gulp release
```

## Updating node dependencies
* `npm audit fix` or `npm update`. This won't remove old packages; to do so,
  delete node_modules and reinstall

## References
* [Run server with webpack](https://dennisreimann.de/articles/vue-cli-serve-express.html)

## Docker

Install docker
```
sudo apt install docker.io
sudo chmod 666 /var/run/docker.sock
```

Useful commands
```console
# Build and run
docker build -t scanservjs-image .
docker rm --force scanservjs-container 2> /dev/null
docker run -d -p 8080:8080 --name scanservjs-container --privileged scanservjs-image

# Debug
docker run -it --entrypoint=/bin/bash scanservjs-container
docker logs scanservjs-container

# Start and stop
docker container rm scanservjs-container
docker container start scanservjs-container
docker container stop scanservjs-container
docker container restart scanservjs-container

# Maintenance
docker ps -a
docker image prune
```

## Mount map configuration files
```
docker run -d \
  -p 8080:8080 \
  -v `pwd`/var/:/app/config/ \
  --name scanservjs-container \
  --privileged \
  scanservjs-image
```
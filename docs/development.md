# Development

## Steps

* Install Node
* Clone the repo
* Navigate to the repo directory
  ```
  sudo npm install -g @vue/cli @vue/cli-service-global gulp-cli
  cd server && npm i . && cd ../webui && npm i .
  ```

## Run for development

```
cd webui && npm run serve
```

This will hook the server component into webpack (see vue.config.js) and
references below.

## Build

Convenience method which performs linting and builds the client and server
```
cd server && gulp
```

or do a release:
```
cd server && gulp release
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
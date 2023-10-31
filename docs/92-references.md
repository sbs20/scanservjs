# References

* vue-i18n: <https://www.codeandweb.com/babeledit/tutorials/how-to-translate-your-vue-app-with-vue-i18n>

## Creating a deb package

* Primer: <https://unix.stackexchange.com/a/30435>
* General examples: <https://github.com/FooBarWidget/debian-packaging-for-the-modern-developer>
* Also useful: <https://www.internalpointers.com/post/build-binary-deb-package-practical-guide>
* Add user: <https://unix.stackexchange.com/questions/47880/how-debian-package-should-create-user-accounts>
* File system hierarchy: <https://unix.stackexchange.com/a/42807>
* The proper way: <https://www.debian.org/doc/manuals/maint-guide/index.en.html>
* systemd: <https://unix.stackexchange.com/questions/306234/is-it-possible-to-install-two-services-for-one-package-using-dh-installinit-how>
* symlinks: <https://stackoverflow.com/a/10502017>

## Docker for dummies

```sh
# Copy image
docker save -o scanservjs-image.tar scanservjs-image
docker load -i scanservjs-image.tar

# Shell inside image
docker run -it --entrypoint=/bin/bash scanservjs-image

# Shell inside running container
docker exec -it scanservjs-container /bin/bash

# Logs
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

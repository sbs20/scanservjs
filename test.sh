#!/bin/sh
# npm run reset
# npm i
# npm run build
# npm run package

# Debian 10 | Node 10
# docker build --file build.Dockerfile --target d10n10 --tag test .
# docker rm --force test-container && docker run -e SANED_NET_HOSTS="10.0.100.30" -d -p 8080:8080 --name test-container test

# Debian 11 | Node 12
# docker build --file build.Dockerfile --target d11n12 --tag test .
# docker rm --force test-container && docker run -e SANED_NET_HOSTS="10.0.100.30" -d -p 8080:8080 --name test-container test

# Debian 12 | Node 20
docker build --file build.Dockerfile --target d12n20 --tag test .
docker rm --force test-container && docker run -e SANED_NET_HOSTS="10.0.100.30" -d -p 8080:8080 --name test-container test
pause
docker rm --force test-container

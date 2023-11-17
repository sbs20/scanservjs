# Builder image
#
# The builder image builds the core javascript app and debian package
# ==============================================================================
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

# Sane image
#
# This is the minimum bookworm/node/sane image required which is used elsewhere.
# Dependencies are installed here in order to anticipate and cache what will
# be required by the deb package. It would all still work perfectly well if this
# layer did not exist but testing would be slower and more painful.
# ==============================================================================
FROM debian:bookworm-slim AS scanservjs-base
RUN apt-get update \
  && apt-get install -yq \
    nodejs \
    adduser \
    imagemagick \
    ipp-usb \
    sane-airscan \
    sane-utils \
    tesseract-ocr \
    tesseract-ocr-ces \
    tesseract-ocr-deu \
    tesseract-ocr-eng \
    tesseract-ocr-spa \
    tesseract-ocr-fra \
    tesseract-ocr-ita \
    tesseract-ocr-nld \
    tesseract-ocr-pol \
    tesseract-ocr-por \
    tesseract-ocr-rus \
    tesseract-ocr-tur \
    tesseract-ocr-chi-sim \
  && rm -rf /var/lib/apt/lists/*;

# Core image
#
# This is the minimum core image required. It installs the base dependencies for
# sane and tesseract. The executing user remains ROOT. If you want to build your
# own image with drivers then this is likely the image to start from.
# ==============================================================================
FROM scanservjs-base AS scanservjs-core
ENV \
  # This goes into /etc/sane.d/net.conf
  SANED_NET_HOSTS="" \
  # This gets added to /etc/sane.d/airscan.conf
  AIRSCAN_DEVICES="" \
  # This gets added to /etc/sane.d/pimxa.conf
  PIXMA_HOSTS="" \
  # This directs scanserv not to bother querying `scanimage -L`
  SCANIMAGE_LIST_IGNORE="" \
  # This gets added to scanservjs/server/config.js:devices
  DEVICES="" \
  # Override OCR language
  OCR_LANG=""

# Copy entry point
COPY entrypoint.sh /entrypoint.sh
RUN ["chmod", "+x", "/entrypoint.sh"]
ENTRYPOINT [ "/entrypoint.sh" ]

# Copy the code and install
COPY --from=scanservjs-build "/app/debian/scanservjs_*.deb" "/"
RUN apt-get install ./scanservjs_*.deb \
  && rm -f ./scanservjs_*.deb

WORKDIR /usr/lib/scanservjs

EXPOSE 8080

# User2001 image
#
# This image changes the executing user to 2001 for increased security. This
# also, however, leads to some runtime issues with parameters. This was the
# default behaviour from v2.9.0 until v2.18.1 and was because issue #177. This
# stage is kept for backwards compatibility.
# ==============================================================================
FROM scanservjs-core AS scanservjs-user2001

# Make it possible to override the UID/GID/username of the user running
# scanservjs
ARG UID=2001
ARG GID=2001
ARG UNAME=scanservjs

# Create a known user, and change ownership on relevant files (the entrypoint
# script and $APP_DIR must be readable to run the service itself, and some
# config files need write access).
RUN groupadd -g $GID -o $UNAME \
  && useradd -o -u $UID -g $GID -m -s /bin/bash $UNAME \
  && chown -R $UID:$GID /entrypoint.sh /var/lib/scanservjs /etc/sane.d/net.conf /etc/sane.d/airscan.conf
USER $UNAME

# default build
FROM scanservjs-core

# hplip image
#
# This image adds the HP scanner libs to the image. This target is not built by
# default - you will need to specifically target it.
# ==============================================================================
FROM scanservjs-core AS scanservjs-hplip
RUN apt-get update \
  && apt-get install -yq libsane-hpaio \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* \
  && echo hpaio >> /etc/sane.d/dll.conf

# brscan4 image
#
# This image includes the brscan4 driver which is needed for some Brother
# printers/scanners. This target is not built by default -
# you will need to specifically target it.
# ==============================================================================
FROM scanservjs-core AS scanservjs-brscan4
RUN apt-get update \
  && apt-get install -yq curl \
  && curl -fSsL "https://download.brother.com/welcome/dlf105200/brscan4-0.4.11-1.amd64.deb" -o /tmp/brscan4.deb \
  && apt-get remove curl -yq \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* \
  && dpkg -i /tmp/brscan4.deb \
  && rm /tmp/brscan4.deb \
  && echo brscan4 >> /etc/sane.d/dll.conf

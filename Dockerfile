# Builder image
#
# The builder image simply builds the core javascript app and nothing else
# ==============================================================================
FROM node:18-alpine AS scanservjs-build
ENV APP_DIR=/app
WORKDIR "$APP_DIR"

COPY package*.json "$APP_DIR/"
COPY packages/server/package*.json "$APP_DIR/packages/server/"
COPY packages/client/package*.json "$APP_DIR/packages/client/"

RUN npm install .

COPY packages/client/ "$APP_DIR/packages/client/"
COPY packages/server/ "$APP_DIR/packages/server/"

RUN npm run build

# Sane image
#
# This is the minimum bookworm/node/sane image required which is used elsewhere.
# ==============================================================================
FROM node:18-bookworm-slim AS scanservjs-base
RUN apt-get update \
  && apt-get install -yq \
    imagemagick \
    sane \
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
    sane-airscan \
    ipp-usb \
  && rm -rf /var/lib/apt/lists/* \
  && sed -i \
    's/policy domain="coder" rights="none" pattern="PDF"/policy domain="coder" rights="read | write" pattern="PDF"'/ \
    /etc/ImageMagick-6/policy.xml \
  && sed -i \
    's/policy domain="resource" name="disk" value="1GiB"/policy domain="resource" name="disk" value="8GiB"'/ \
    /etc/ImageMagick-6/policy.xml \
  && npm install -g npm@8.3.0 \
  && npm cache clean --force;

# Core image
#
# This is the minimum core image required. It installs the base dependencies for
# sane and tesseract. The executing user remains ROOT. If you want to build your
# own image with drivers then this is likely the image to start from.
# ==============================================================================
FROM scanservjs-base AS scanservjs-core

ENV APP_DIR=/app
WORKDIR "$APP_DIR"

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
COPY run.sh /run.sh
RUN ["chmod", "+x", "/run.sh"]
ENTRYPOINT [ "/run.sh" ]

# Copy the code and install
COPY --from=scanservjs-build "$APP_DIR/dist" "$APP_DIR/"
RUN npm install --production \
  && npm cache clean --force;

EXPOSE 8080

# User2001 image
#
# This image changes the executing user to 2001 for increased security. This
# also, however, leads to some runtime issues with parameters. This was the
# default behaviour from v2.9.0 until v2.18.1 and was because issue #177. This
# stage is kept for backwards compatibility.
# ==============================================================================
FROM scanservjs-core AS scanservjs-user2001

# Make it possible to override the UID/GID/username of the user running scanservjs
ARG UID=2001
ARG GID=2001
ARG UNAME=scanservjs

# Create a known user, and change ownership on relevant files (the entrypoint
# script and $APP_DIR must be readable to run the service itself, and some
# config files need write access).
RUN groupadd -g $GID -o $UNAME \
  && useradd -o -u $UID -g $GID -m -s /bin/bash $UNAME \
  && chown -R $UID:$GID /run.sh "$APP_DIR" /etc/sane.d/net.conf /etc/sane.d/airscan.conf
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

# Builder image
#
# The builder image simply builds the core javascript app and nothing else
# ==============================================================================
FROM node:16-alpine AS scanservjs-build
ENV APP_DIR=/app
WORKDIR "$APP_DIR"

COPY package*.json "$APP_DIR/"
COPY packages/server/package*.json "$APP_DIR/packages/server/"
COPY packages/client/package*.json "$APP_DIR/packages/client/"

RUN npm run install

COPY packages/client/ "$APP_DIR/packages/client/"
COPY packages/server/ "$APP_DIR/packages/server/"

RUN npm run build

# Sane image
#
# This is the minimum bullseye/node/sane image required which is used elsewhere.
# ==============================================================================
FROM node:16-bullseye-slim AS scanservjs-base
RUN apt-get update \
  && apt-get install -yq \
    imagemagick \
    sane \
    sane-utils \
    tesseract-ocr \
    sane-airscan \
  && sed -i \
    's/policy domain="coder" rights="none" pattern="PDF"/policy domain="coder" rights="read | write" pattern="PDF"'/ \
    /etc/ImageMagick-6/policy.xml \
  && sed -i \
    's/policy domain="resource" name="disk" value="1GiB"/policy domain="resource" name="disk" value="8GiB"'/ \
    /etc/ImageMagick-6/policy.xml \
  && npm install -g npm@8.3.0

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
  # This directs scanserv not to bother querying `scanimage -L`
  SCANIMAGE_LIST_IGNORE="" \
  # This gets added to scanservjs/server/config.js:devices
  DEVICES="" \
  # Override OCR language
  OCR_LANG=""

# Copy entry point
COPY run.sh /run.sh
RUN ["chmod", "+x", "/run.sh"]
ENTRYPOINT [ "/run.sh" ]

# Copy the code and install
COPY --from=scanservjs-build "$APP_DIR/dist" "$APP_DIR/"
RUN npm install --production

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

# Create a known user
RUN groupadd -g $GID -o $UNAME
RUN useradd -o -u $UID -g $GID -m -s /bin/bash $UNAME

# Change the ownership of config and data since we need to write there
RUN chown -R $UID:$GID config data /etc/sane.d/net.conf /etc/sane.d/airscan.conf
USER $UNAME

# default build
FROM scanservjs-core

# hplip image
#
# This image adds the HP scanner libs to the image. This target is not built by
# default - you will need to specifically target it.
# ==============================================================================
FROM scanservjs-core AS scanservjs-hplip
RUN apt-get install -yq libsane-hpaio \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* \
  && echo hpaio >> /etc/sane.d/dll.conf

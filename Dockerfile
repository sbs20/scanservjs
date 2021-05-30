# Builder image. Alpine doesn't have python which is required by node-sass
FROM node:14-buster AS builder
ENV APP_DIR=/app
WORKDIR "$APP_DIR"

COPY package*.json "$APP_DIR/"
COPY packages/server/package*.json "$APP_DIR/packages/server/"
COPY packages/client/package*.json "$APP_DIR/packages/client/"

RUN npm run install

COPY packages/client/ "$APP_DIR/packages/client/"
COPY packages/server/ "$APP_DIR/packages/server/"

RUN npm run build

# production image
FROM node:14-buster-slim

# Make it possible to override the UID/GID/username of the user running scanservjs
ARG UID=2001
ARG GID=2001
ARG UNAME=scanservjs

ENV APP_DIR=/app
WORKDIR "$APP_DIR"
RUN apt-get update \
  && apt-get install -yq curl gpg \
  && echo 'deb http://download.opensuse.org/repositories/home:/pzz/Debian_10/ /' \
    | tee /etc/apt/sources.list.d/home:pzz.list \
  && curl -fsSL https://download.opensuse.org/repositories/home:pzz/Debian_10/Release.key \
    | gpg --dearmor \
    | tee /etc/apt/trusted.gpg.d/home:pzz.gpg \
    > /dev/null \
  && apt-get update \
  && apt-get install -yq \
    imagemagick \
    sane \
    sane-utils \
    sane-airscan \
    tesseract-ocr \
  && sed -i \
    's/policy domain="coder" rights="none" pattern="PDF"/policy domain="coder" rights="read | write" pattern="PDF"'/ \
    /etc/ImageMagick-6/policy.xml \
  && npm install -g npm@7.11.2

# Create a known user
RUN groupadd -g $GID -o $UNAME
RUN useradd -o -u $UID -g $GID -m -s /bin/bash $UNAME

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
COPY --from=builder "$APP_DIR/dist" "$APP_DIR/"
RUN npm install --production

# Change the ownership of config and data since we need to write there
RUN chown -R $UID:$GID config data /etc/sane.d/net.conf /etc/sane.d/airscan.conf
USER $UNAME

EXPOSE 8080

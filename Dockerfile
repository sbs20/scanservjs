# Builder image. Alpine doesn't have python which is required by node-sass
FROM node:buster AS builder
ENV APP_DIR=/app
WORKDIR "$APP_DIR"

COPY server/package*.json "$APP_DIR/server/"
COPY webui/package*.json "$APP_DIR/webui/"

RUN cd server \
  && npm i --loglevel=error \
  && cd ../webui \
  && npm i --loglevel=error

COPY webui/ "$APP_DIR/webui/"
COPY server/ "$APP_DIR/server/"

RUN cd webui \
  && npm run build \
  && cd ../server \
  && npm run server-build

# production image
FROM node:buster-slim
ENV APP_DIR=/app
WORKDIR "$APP_DIR"
RUN apt-get update \
  && apt-get install -yq curl gpg \
  && echo 'deb http://download.opensuse.org/repositories/home:/pzz/Debian_10/ /' | tee /etc/apt/sources.list.d/home:pzz.list \
  && curl -fsSL https://download.opensuse.org/repositories/home:pzz/Debian_10/Release.key | gpg --dearmor | tee /etc/apt/trusted.gpg.d/home:pzz.gpg > /dev/null \
  && apt-get update \
  && apt-get install -yq \
    imagemagick \
    sane \
    sane-utils \
    sane-airscan \
    tesseract-ocr \
  && sed -i 's/policy domain="coder" rights="none" pattern="PDF"/policy domain="coder" rights="read | write" pattern="PDF"'/ /etc/ImageMagick-6/policy.xml

# Create a known user
RUN useradd -u 2001 -ms /bin/bash scanservjs

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
RUN chown -R scanservjs:scanservjs config data /etc/sane.d/net.conf /etc/sane.d/airscan.conf
USER scanservjs

EXPOSE 8080

# builder image
FROM node:buster AS builder
ENV APP_DIR=/app
WORKDIR "$APP_DIR"
COPY package*.json "$APP_DIR/"
RUN npm install
COPY . "$APP_DIR"
RUN npm run server-build && npm run client-build

# production image
FROM node:buster-slim
ENV APP_DIR=/app
WORKDIR "$APP_DIR"
COPY --from=builder "$APP_DIR/dist" "$APP_DIR/"

RUN apt-get update && \
  apt-get install -yq curl gpg && \
  echo 'deb http://download.opensuse.org/repositories/home:/pzz/Debian_10/ /' | tee /etc/apt/sources.list.d/home:pzz.list && \
  curl -fsSL https://download.opensuse.org/repositories/home:pzz/Debian_10/Release.key | gpg --dearmor | tee /etc/apt/trusted.gpg.d/home:pzz.gpg > /dev/null && \
  apt-get update && \
  apt-get install -yq sane sane-utils imagemagick tesseract-ocr sane-airscan && \
  sed -i 's/policy domain="coder" rights="none" pattern="PDF"/policy domain="coder" rights="read | write" pattern="PDF"'/ /etc/ImageMagick-6/policy.xml

RUN npm install --production

# This goes into /etc/sane.d/net.conf
ENV SANED_NET_HOSTS=""

# This gets added to /etc/sane.d/airscan.conf
ENV AIRSCAN_DEVICES=""

# This directs scanserv not to bother querying `scanimage -L`
ENV SCANIMAGE_LIST_IGNORE=""

# This gets added to scanservjs/config/config.js:devices
ENV DEVICES=""

# Override OCR language
ENV OCR_LANG=""

# Copy entry point
COPY run.sh /run.sh
RUN ["chmod", "+x", "/run.sh"]
ENTRYPOINT [ "/run.sh" ]
EXPOSE 8080

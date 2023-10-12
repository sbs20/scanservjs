FROM node:10-buster-slim AS d10n10

WORKDIR /app

RUN apt-get update \
  && apt-get install -yq \
    imagemagick \
    sane \
    sane-utils \
    tesseract-ocr;

COPY release/* /tmp/
RUN mkdir -p /app \
  && tar -xvf /tmp/scanservjs*.tar.gz -C /app \
  && cd /app \
  && npm i --omit=dev;

# Copy entry point
COPY run.sh /run.sh
RUN ["chmod", "+x", "/run.sh"]
ENTRYPOINT [ "/run.sh" ]

EXPOSE 8080


FROM node:12-bullseye-slim AS d11n12

WORKDIR /app

RUN apt-get update \
  && apt-get install -yq \
    imagemagick \
    sane \
    sane-utils \
    tesseract-ocr \
    sane-airscan \
    ipp-usb;

COPY release/* /tmp/
RUN mkdir -p /app \
  && tar -xvf /tmp/scanservjs*.tar.gz -C /app \
  && cd /app \
  && npm i --omit=dev;

# Copy entry point
COPY run.sh /run.sh
RUN ["chmod", "+x", "/run.sh"]
ENTRYPOINT [ "/run.sh" ]

EXPOSE 8080


FROM node:20-bookworm-slim AS d12n20

WORKDIR /app

RUN apt-get update \
  && apt-get install -yq \
    imagemagick \
    sane \
    sane-utils \
    tesseract-ocr \
    sane-airscan \
    ipp-usb;

COPY release/* /tmp/
RUN mkdir -p /app \
  && tar -xvf /tmp/scanservjs*.tar.gz -C /app \
  && cd /app \
  && npm i --omit=dev;

# Copy entry point
COPY run.sh /run.sh
RUN ["chmod", "+x", "/run.sh"]
ENTRYPOINT [ "/run.sh" ]

EXPOSE 8080

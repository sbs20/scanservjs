# builder image
FROM node:buster AS builder
ENV APP_DIR=/app
WORKDIR "$APP_DIR"
COPY package*.json "$APP_DIR/"
RUN npm install
COPY . "$APP_DIR"
RUN npm run server-build
RUN npm run client-build

# production image
FROM node:buster-slim
ENV APP_DIR=/app
WORKDIR "$APP_DIR"
# Install sane
RUN apt-get update && apt-get install -yq sane sane-utils imagemagick tesseract-ocr
RUN sed -i 's/policy domain="coder" rights="none" pattern="PDF"/policy domain="coder" rights="read | write" pattern="PDF"'/ /etc/ImageMagick-6/policy.xml
COPY --from=builder "$APP_DIR/dist" "$APP_DIR/"

# Install dependencies
RUN npm install --production

ENV NET_HOST=""

# Copy entry point
COPY run.sh /run.sh
RUN ["chmod", "+x", "/run.sh"]
ENTRYPOINT [ "/run.sh" ]
EXPOSE 8080

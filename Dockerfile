FROM node:8 AS builder

ENV APP_DIR=/app

RUN mkdir "$APP_DIR"

COPY . "$APP_DIR"

# run a gulp build
RUN cd "$APP_DIR" \
 && npm install \
 && ./node_modules/.bin/gulp

# production image
FROM node:8

# Install sane
RUN apt-get update && apt-get install -yq sane sane-utils imagemagick

ENV APP_DIR=/app

RUN mkdir "$APP_DIR"

COPY --from=builder "$APP_DIR/build/" "$APP_DIR/"

# Install Scanserver
RUN cd "$APP_DIR" \
 && npm install --production

# Copy built assets from builder image

WORKDIR "$APP_DIR"
CMD ["node", "server.js"]

EXPOSE 8080

FROM node:8 AS builder

ENV APP_DIR=/app
WORKDIR "$APP_DIR"

# install build dependencies
COPY package.json "$APP_DIR"
RUN npm install

# run a gulp build
COPY . "$APP_DIR"
RUN ./node_modules/.bin/gulp

# production image
FROM node:8
ENV APP_DIR=/app
WORKDIR "$APP_DIR"
# Install sane
RUN apt-get update && apt-get install -yq sane sane-utils imagemagick

COPY --from=builder "$APP_DIR/build/scanservjs" "$APP_DIR/"

# Install dependencies
RUN npm install --production

# Copy built assets from builder image

CMD ["node", "server.js"]

EXPOSE 8080

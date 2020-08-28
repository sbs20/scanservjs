FROM node:buster AS builder

ENV APP_DIR=/app
WORKDIR "$APP_DIR"

# install build dependencies
COPY package.json "$APP_DIR"
RUN npm install

# run a gulp build
COPY . "$APP_DIR"
RUN npm run build

# production image
FROM node:buster-slim
ENV APP_DIR=/app
WORKDIR "$APP_DIR"
# Install sane
RUN apt-get update && apt-get install -yq sane sane-utils imagemagick
RUN sed -i '/policy domain="coder" rights="none" pattern="PDF"/d' /etc/ImageMagick-6/policy.xml

COPY --from=builder "$APP_DIR/build/scanservjs" "$APP_DIR/"

# Install dependencies
RUN npm install --production


ENV NET_HOST=""

# Copy built assets from builder image

COPY entrypoint.sh /entrypoint.sh

ENTRYPOINT [ "/entrypoint.sh" ]

EXPOSE 8080

FROM node:8

# Install sane
RUN apt-get update && apt-get install -yq sane sane-utils imagemagick


ENV APP_DIR=/app
ENV APP_NAME=scanservjs

COPY ./build $APP_DIR
COPY ./package.json $APP_DIR

# Install Scanserver
RUN cd $APP_DIR/$APP_NAME \
  && npm install --production

WORKDIR $APP_DIR/$APP_NAME
CMD ["node", "server.js"]

EXPOSE 8080

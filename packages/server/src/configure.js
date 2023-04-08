const express = require('express');
const basicAuth = require('express-basic-auth');
const fs = require('fs');
const path = require('path');
const rootLog = require('loglevel');
const prefix = require('loglevel-plugin-prefix');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const FileInfo = require('./classes/file-info');
const application = require('./application');
const config = application.config();

// We need to apply logging setting prior to anything else using a logger
prefix.reg(rootLog);
rootLog.enableAll();
rootLog.setLevel(config.log.level);
prefix.apply(rootLog, config.log.prefix);

const log = rootLog.getLogger('Http');
const api = require('./api');

/**
 * @param {import('express').Response} res
 * @param {number} code
 * @param {any} data
 */
function sendError(res, code, data) {
  let content = {
    message: ''
  };
  log.error(data);
  if (typeof data === 'object') {
    content.message = data.message || JSON.stringify(data);
    content.code = data.code || -1;
  } else if (typeof data === 'string') {
    content.message = data;
  }
  res.status(code).send(content);
}

/**
 * @param {import('express').Request} req
 */
function logRequest(req) {
  const properties = ['method', 'path', 'params', 'query', 'body'];
  const output = {};
  for (const property of properties) {
    if (property in req) {
      if (typeof req[property] === 'string' || (typeof req[property] === 'object' && Object.keys(req[property]).length > 0)) {
        output[property] = req[property];
      }
    }
  }
  log.info(output);
}

/**
 * @param {string} rootPath
 */
function initialize(rootPath) {
  if (rootPath) {
    log.warn(`Running with altered rootPath: ${rootPath}`);
    // Only required for running in development
    Object.assign(config, {
      devicesPath: rootPath + config.devicesPath,
      outputDirectory: rootPath + config.outputDirectory,
      thumbnailDirectory: rootPath + config.thumbnailDirectory,
      previewDirectory: rootPath + config.previewDirectory,
      tempDirectory: rootPath + config.tempDirectory
    });
  }

  try {
    fs.mkdirSync(config.outputDirectory, { recursive: true });
    fs.mkdirSync(config.thumbnailDirectory, { recursive: true });
    fs.mkdirSync(config.tempDirectory, { recursive: true });
  } catch (exception) {
    log.warn(`Error ensuring output and temp directories exist: ${exception}`);
    log.warn(`Currently running node version ${process.version}.`);
  }
}

/**
 * Configures express
 * @param {import('express').Express} app
 * @param {string} rootPath
 */
function configure(app, rootPath) {
  initialize(rootPath);
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

  if (Object.keys(config.users).length > 0) {
    app.use(basicAuth({
      users: config.users,
      challenge: true,
    }));
  }

  const swaggerSpec = swaggerJsdoc({
    failOnErrors: true,
    swaggerDefinition: {
      openapi: '3.0.0',
      info: {
        title: config.applicationName,
        description: config.applicationDescription,
        version: config.version,
      },
    },
    apis: [
      path.join(__dirname, 'swagger.yml')
    ],
  });

  const swaggerUiOptions = {
    swaggerOptions: {
      url: '/api-docs/swagger.json',
    },
  };

  app.get(
    swaggerUiOptions.swaggerOptions.url,
    (req, res) => res.json(swaggerSpec));

  app.use(
    '/api-docs',
    swaggerUi.serveFiles(swaggerSpec, swaggerUiOptions),
    swaggerUi.setup(swaggerSpec, swaggerUiOptions));

  app.delete('/context', (req, res) => {
    logRequest(req);
    try {
      api.deleteContext();
      res.send({});
    } catch (error) {
      sendError(res, 500, error);
    }
  });

  app.get('/context', async (req, res) => {
    logRequest(req);
    try {
      res.send(await api.readContext());
    } catch (error) {
      sendError(res, 500, error);
    }
  });

  app.get('/files', async (req, res) => {
    logRequest(req);
    try {
      res.send(await api.fileList());
    } catch (error) {
      sendError(res, 500, error);
    }
  });

  app.post(/\/files\/([^/]+)\/actions\/([^/]+)/, async (req, res) => {
    logRequest(req);
    try {
      const fileName = req.params[0];
      const actionName = req.params[1];
      await api.fileAction(actionName, fileName);
      res.send('200');
    } catch (error) {
      sendError(res, 500, error);
    }
  });

  app.get(/\/files\/([^/]+)\/thumbnail/, async (req, res) => {
    logRequest(req);
    try {
      const name = req.params[0];
      const buffer = await api.readThumbnail(name);
      res.type('jpg');
      res.send(buffer);
    } catch (error) {
      sendError(res, 500, error);
    }
  });

  app.get(/\/files\/([^/]+)/, (req, res) => {
    logRequest(req);
    try {
      const name = req.params[0];
      const file = FileInfo.unsafe(config.outputDirectory, name);
      res.download(file.fullname);
    } catch (error) {
      sendError(res, 500, error);
    }
  });

  app.delete('/files/*', (req, res) => {
    logRequest(req);
    try {
      res.send(api.fileDelete(req.params[0]));
    } catch (error) {
      sendError(res, 500, error);
    }
  });

  app.put('/files/*', async (req, res) => {
    logRequest(req);
    try {
      const name = req.params[0];
      const newName = req.body.newName;
      await FileInfo.unsafe(config.outputDirectory, name)
        .rename(newName);
      const thumbnail = FileInfo.unsafe(config.thumbnailDirectory, name);
      if (thumbnail.exists()) thumbnail.rename(newName);
      res.send('200');
    } catch (error) {
      sendError(res, 500, error);
    }
  });

  app.get('/preview', async (req, res) => {
    logRequest(req);
    try {
      const buffer = await api.readPreview(req.query.filter);
      res.send({
        content: buffer.toString('base64')
      });
    } catch (error) {
      sendError(res, 500, error);
    }
  });

  app.delete('/preview', (req, res) => {
    logRequest(req);
    try {
      res.send(api.deletePreview());
    } catch (error) {
      sendError(res, 500, error);
    }
  });

  app.post('/preview', async (req, res) => {
    logRequest(req);
    try {
      res.send(await api.createPreview(req.body));
    } catch (error) {
      sendError(res, 500, error);
    }
  });

  app.post('/scan', async (req, res) => {
    logRequest(req);
    try {
      res.send(await api.scan(req.body));
    } catch (error) {
      sendError(res, 500, error);
    }
  });

  app.get('/system', async (req, res) => {
    logRequest(req);
    try {
      res.send(await api.readSystem());
    } catch (error) {
      sendError(res, 500, error);
    }
  });
}

module.exports = configure;

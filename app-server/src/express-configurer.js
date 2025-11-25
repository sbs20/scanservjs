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
function formatForLog(req) {
  const properties = ['method', 'path', 'params', 'query', 'body'];
  const output = properties
    .filter(property => property in req)
    .filter(property => typeof req[property] === 'string'
      || (typeof req[property] === 'object' && Object.keys(req[property]).length > 0))
    .reduce((accumulator, property) => {
      accumulator[property] = req[property];
      return accumulator;
    }, {});
  return output;
}

/**
 * Middleware to wrap async route handlers and catch errors
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(error => {
    sendError(res, 500, error);
  });
};

/**
 * Logging middleware
 */
const loggingMiddleware = (req, res, next) => {
  log.info(formatForLog(req));
  next();
};

/**
 * Create API router with all endpoints
 */
function createApiRouter() {
  const router = express.Router();

  // Context routes
  router.delete('/context', asyncHandler(async (req, res) => {
    api.deleteContext();
    res.send({});
  }));

  router.get('/context', asyncHandler(async (req, res) => {
    res.send(await api.readContext());
  }));

  // Files routes
  router.get('/files', asyncHandler(async (req, res) => {
    res.send(await api.fileList());
  }));

  router.post('/files/:fileName/actions/:actionName', asyncHandler(async (req, res) => {
    const { fileName, actionName } = req.params;
    await api.fileAction(actionName, fileName);
    res.send('200');
  }));

  router.get('/files/:fileName/thumbnail', asyncHandler(async (req, res) => {
    const { fileName } = req.params;
    const buffer = await api.readThumbnail(fileName);
    res.type('jpg');
    res.send(buffer);
  }));

  router.get('/files/:fileName', asyncHandler(async (req, res) => {
    const { fileName } = req.params;
    const file = FileInfo.unsafe(config.outputDirectory, fileName);
    res.download(file.fullname);
  }));

  router.delete('/files/:fileName', asyncHandler(async (req, res) => {
    const { fileName } = req.params;
    res.send(api.fileDelete(fileName));
  }));

  router.put('/files/:fileName', asyncHandler(async (req, res) => {
    const { fileName } = req.params;
    const { newName } = req.body;
    await FileInfo.unsafe(config.outputDirectory, fileName).rename(newName);
    const thumbnail = FileInfo.unsafe(config.thumbnailDirectory, fileName);
    if (thumbnail.exists()) {
      thumbnail.rename(newName);
    }
    res.send('200');
  }));

  // Preview routes
  router.get('/preview', asyncHandler(async (req, res) => {
    const buffer = await api.readPreview(req.query.filter);
    res.send({
      content: buffer.toString('base64')
    });
  }));

  router.delete('/preview', asyncHandler(async (req, res) => {
    res.send(api.deletePreview());
  }));

  router.post('/preview', asyncHandler(async (req, res) => {
    res.send(await api.createPreview(req.body));
  }));

  // Scan route
  router.post('/scan', asyncHandler(async (req, res) => {
    res.send(await api.scan(req.body));
  }));

  // System route
  router.get('/system', asyncHandler(async (req, res) => {
    res.send(await api.readSystem());
  }));

  return router;
}

module.exports = class ExpressConfigurer {
  /**
   * Constructor
   * @param {import('express').Express} app
   */
  constructor(app) {
    this.app = app;

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
   * Configures basic authentication
   * @returns {ExpressConfigurer}
   */
  basicAuth() {
    if (Object.keys(config.users).length > 0) {
      this.app.use(basicAuth({
        users: config.users,
        challenge: true,
      }));
    }
    return this;
  }

  /**
   * Configures encoding
   * @returns {ExpressConfigurer}
   */
  encoding() {
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(express.json());
    return this;
  }

  /**
   * Configures endpoints
   * @returns {ExpressConfigurer}
   */
  endpoints() {
    const apiRouter = createApiRouter();
    this.app.use('/api/v1', loggingMiddleware, apiRouter);
    return this;
  }

  /**
   * Configures statics
   * @returns {ExpressConfigurer}
   */
  statics() {
    this.app.use(express.static('client'));
    return this;
  }

  /**
   * Configures swagger
   * @returns {ExpressConfigurer}
   */
  swagger() {
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

    this.app.get(
      swaggerUiOptions.swaggerOptions.url,
      (req, res) => res.json(swaggerSpec));

    this.app.use(
      '/api-docs',
      swaggerUi.serveFiles(swaggerSpec, swaggerUiOptions),
      swaggerUi.setup(swaggerSpec, swaggerUiOptions));

    return this;
  }

  /**
   * Configures express
   * @param {import('express').Express} app
   */
  static with(app) {
    return new ExpressConfigurer(app);
  }
};

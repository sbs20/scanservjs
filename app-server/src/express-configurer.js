const express = require('express');
const basicAuth = require('express-basic-auth');
const helmet = require('helmet');
const fs = require('fs');
const path = require('path');
const rootLog = require('loglevel');
const prefix = require('loglevel-plugin-prefix');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const FileInfo = require('./classes/file-info');
const Process = require('./classes/process');
const application = require('./application');
const config = application.config();

// We need to apply logging setting prior to anything else using a logger
prefix.reg(rootLog);
rootLog.enableAll();
rootLog.setLevel(config.log.level);
prefix.apply(rootLog, config.log.prefix);

const log = rootLog.getLogger('Http');
const api = require('./api');
const editorApi = require('./editor-api');

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
 * Definition of all endpoints
 */
const EndpointSpecs = [
  {
    method: 'delete',
    path: '/api/v1/context',
    callback: async (req, res) => {
      api.deleteContext();
      res.send({});
    }
  },
  {
    method: 'get',
    path: '/api/v1/context',
    callback: async (req, res) => res.send(await api.readContext())
  },
  {
    method: 'get',
    path: '/api/v1/files',
    callback: async (req, res) => res.send(await api.fileList())
  },
  {
    method: 'post',
    path: /\/api\/v1\/files\/([^/]+)\/actions\/([^/]+)/,
    callback: async (req, res) => {
      const fileName = req.params[0];
      const actionName = req.params[1];
      await api.fileAction(actionName, fileName);
      res.send('200');
    }
  },
  {
    method: 'get',
    path: /\/api\/v1\/files\/([^/]+)\/thumbnail/,
    callback: async (req, res) => {
      const name = req.params[0];
      const buffer = await api.readThumbnail(name);
      res.type('jpg');
      res.send(buffer);
    }
  },
  {
    method: 'get',
    path: /\/api\/v1\/files\/([^/]+)/,
    callback: async (req, res) => {
      const name = req.params[0];
      const file = FileInfo.unsafe(config.outputDirectory, name);
      const ext = path.extname(name).toLowerCase();
      
      if (req.query.preview === 'true') {
        const mimeTypes = {
          '.pdf': 'application/pdf',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.tif': 'image/tiff',
          '.tiff': 'image/tiff',
          '.txt': 'text/plain'
        };

        if (ext === '.tif' || ext === '.tiff') {
          try {
            const buffer = await Process.spawn(`convert '${file.fullname}'[0] jpg:-`);
            res.setHeader('Content-Type', 'image/jpeg');
            res.setHeader('Content-Disposition', `inline; filename="${name}.jpg"`);
            res.send(buffer);
            return;
          } catch (e) {
            log.error(`TIFF preview failed for ${name}: ${e.message}`);
          }
        }

        const contentType = mimeTypes[ext] || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `inline; filename="${name}"`);
        res.sendFile(path.resolve(file.fullname));
      } else {
        res.download(file.fullname);
      }
    }
  },
  {
    method: 'delete',
    path: '/api/v1/files/*',
    callback: async (req, res) => res.send(api.fileDelete(req.params[0]))
  },
  {
    method: 'put',
    path: '/api/v1/files/*',
    callback: async (req, res) => {
      const name = req.params[0];
      const newName = req.body.newName;
      await FileInfo.unsafe(config.outputDirectory, name).rename(newName);
      const thumbnail = FileInfo.unsafe(config.thumbnailDirectory, name);
      if (thumbnail.exists()) {
        thumbnail.rename(newName);
      }
      res.send('200');
    }
  },
  {
    method: 'get',
    path: '/api/v1/preview',
    callback: async (req, res) => {
      const buffer = await api.readPreview(req.query.filter);
      res.send({
        content: buffer.toString('base64')
      });
    }
  },
  },
  {
    method: 'delete',
    path: '/api/v1/preview',
    callback: async (req, res) => res.send(api.deletePreview())
  },
  {
    method: 'post',
    path: '/api/v1/preview',
    callback: async (req, res) => res.send(await api.createPreview(req.body))
  },
  {
    method: 'post',
    path: '/api/v1/scan',
    callback: async (req, res) => res.send(await api.scan(req.body))
  },
  {
    method: 'get',
    path: '/api/v1/system',
    callback: async (req, res) => res.send(await api.readSystem())
  },
  {
    method: 'post',
    path: '/api/v1/editor/sessions',
    callback: async (req, res) => {
      const result = await editorApi.createSession(req.body.files);
      res.send(result);
    }
  },
  {
    method: 'get',
    path: /\/api\/v1\/editor\/sessions\/([^/]+)$/,
    callback: async (req, res) => {
      res.send(editorApi.getSession(req.params[0]));
    }
  },
  {
    method: 'get',
    path: /\/api\/v1\/editor\/sessions\/([^/]+)\/pages\/(\d+)\/thumbnail/,
    callback: async (req, res) => {
      const buffer = await editorApi.getThumbnail(req.params[0], parseInt(req.params[1], 10));
      res.type('jpg');
      res.send(buffer);
    }
  },
  {
    method: 'post',
    path: /\/api\/v1\/editor\/sessions\/([^/]+)\/pages/,
    callback: async (req, res) => {
      const result = await editorApi.addPages(req.params[0], req.body.file);
      res.send(result);
    }
  },
  {
    method: 'post',
    path: /\/api\/v1\/editor\/sessions\/([^/]+)\/save/,
    callback: async (req, res) => {
      const result = await editorApi.save(
        req.params[0], req.body.pages, req.body.filename);
      res.send(result);
    }
  },
  {
    method: 'delete',
    path: /\/api\/v1\/editor\/sessions\/([^/]+)/,
    callback: async (req, res) => {
      editorApi.deleteSession(req.params[0]);
      res.send({});
    }
  }
];

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

    // Editor: clean up orphaned sessions from previous runs
    editorApi.startupCleanup();
    // Editor: TTL-based cleanup every 5 minutes
    setInterval(() => editorApi.ttlCleanup(), 5 * 60 * 1000);
  }

  /**
   * Configures security headers
   * @returns {ExpressConfigurer}
   */
  securityHeaders() {
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:"],
          frameSrc: ["'self'"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", "data:"],
        }
      },
      crossOriginEmbedderPolicy: false,
      frameguard: { action: 'sameorigin' },
    }));
    return this;
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
    EndpointSpecs.forEach(spec => {
      this.app[spec.method](spec.path, async (req, res) => {
        log.info(formatForLog(req));
        try {
          await spec.callback(req, res);
        } catch (error) {
          sendError(res, 500, error);
        }
      });
    });
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

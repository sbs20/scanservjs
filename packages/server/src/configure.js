const express = require('express');
const fs = require('fs');
const rootLog = require('loglevel');
const prefix = require('loglevel-plugin-prefix');
const Config = require('./config');
const FileInfo = require('./file-info');

// We need to apply logging setting prior to anything else using a logger
prefix.reg(rootLog);
rootLog.enableAll();
rootLog.setLevel(Config.log.level);
prefix.apply(rootLog, Config.log.prefix);

const log = rootLog.getLogger('Http');
const Api = require('./api');

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
      if (typeof req[property] === 'string') {
        output[property] = req[property];
      } else if (typeof req[property] === 'object' && Object.keys(req[property]).length > 0) {
        output[property] = req[property];
      }
    }
  }
  log.debug('request: ', output);
}

/**
 * @param {string} rootPath 
 */
function initialize(rootPath) {
  if (rootPath) {
    // Only required for running in development
    Object.assign(Config, {
      devicesPath: rootPath + Config.devicesPath,
      outputDirectory: rootPath + Config.outputDirectory,
      previewDirectory: rootPath + Config.previewDirectory,
      tempDirectory: rootPath + Config.tempDirectory,
      allowUnsafePaths: true
    });
  }
  
  try {
    fs.mkdirSync(Config.outputDirectory, { recursive: true });
    fs.mkdirSync(Config.tempDirectory, { recursive: true });
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

  app.delete('/context', (req, res) => {
    logRequest(req);
    try {
      Api.deleteContext();
      res.send({});
    } catch (error) {
      sendError(res, 500, error);
    }
  });

  app.get('/context', async (req, res) => {
    logRequest(req);
    try {
      res.send(await Api.readContext());
    } catch (error) {
      sendError(res, 500, error);
    }
  });

  app.get('/files', async (req, res) => {
    logRequest(req);
    try {
      res.send(await Api.fileList());
    } catch (error) {
      sendError(res, 500, error);
    }
  });

  app.get('/files/*', (req, res) => {
    logRequest(req);
    try {
      const name = req.params[0];
      const file = FileInfo.unsafe(Config.outputDirectory, name);
      res.download(file.fullname);
    } catch (error) {
      sendError(res, 500, error);
    }
  });

  app.delete('/files/*', (req, res) => {
    logRequest(req);
    try {
      res.send(Api.fileDelete(req.params[0]));
    } catch (error) {
      sendError(res, 500, error);
    }
  });

  app.put('/files/*', async (req, res) => {
    logRequest(req);
    try {
      const name = req.params[0];
      const newName = req.body.newName;
      await FileInfo.unsafe(Config.outputDirectory, name)
        .move(`${Config.outputDirectory}/${newName}`);
      res.send('200');
    } catch (error) {
      sendError(res, 500, error);
    }
  });

  app.post('/preview', async (req, res) => {
    logRequest(req);
    try {
      const buffer = await Api.readPreview(req.body);
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
      res.send(Api.deletePreview());
    } catch (error) {
      sendError(res, 500, error);
    }
  });

  app.post('/scanner/preview', async (req, res) => {
    logRequest(req);
    try {
      res.send(await Api.createPreview(req.body));
    } catch (error) {
      sendError(res, 500, error);
    }
  });

  app.post('/scanner/scan', async (req, res) => {
    logRequest(req);
    try {
      res.send(await Api.scan(req.body));
    } catch (error) {
      sendError(res, 500, error);
    }
  });

  app.get('/system', async (req, res) => {
    logRequest(req);
    try {
      res.send(await Api.readSystem());
    } catch (error) {
      sendError(res, 500, error);
    }
  });
}

module.exports = configure;

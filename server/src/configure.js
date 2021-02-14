const fs = require('fs');
const rootLog = require('loglevel');
const prefix = require('loglevel-plugin-prefix');
const Config = require('./config');

// We need to apply logging setting prior to anything else using a logger
prefix.reg(rootLog);
rootLog.enableAll();
rootLog.setLevel(Config.log.level);
prefix.apply(rootLog, Config.log.prefix);

const log = rootLog.getLogger('Http');
const bodyParser = require('body-parser');
const Api = require('./api');

const sendError = (res, code, data) => {
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
};

const logRequest = (req) => {
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
};

const initialize = (rootPath) => {
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
  
  fs.mkdirSync(Config.outputDirectory, { recursive: true });
  fs.mkdirSync(Config.tempDirectory, { recursive: true });
};

module.exports = (app, rootPath) => {
  initialize(rootPath);
  app.use(bodyParser.urlencoded({
    extended: true
  }));

  app.use(bodyParser.json());

  app.get(['/context', '/context/:force'], async (req, res) => {
    logRequest(req);
    const force = req.params.force && req.params.force === 'force';
    try {
      res.send(await Api.context(force));
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
      res.download(req.params[0]);
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

  app.use(bodyParser.json());
};
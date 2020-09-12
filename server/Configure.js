const log = require('loglevel');
const prefix = require('loglevel-plugin-prefix');
const Config = require('../config/config');

// We need to apply logging setting prior to anything else using a logger
prefix.reg(log);
log.enableAll();
log.setLevel(Config.log.level);
prefix.apply(log, Config.log.prefix);

const bodyParser = require('body-parser');
const Api = require('./Api');

const forbidden = function (req, res) {
  res.status(403).send('<h1>Error 403: Forbidden</h1>');
};

const sendError = (res, httpCode, data) => {
  let content = {
    message: '',
    code: -1
  };
  log.error(data);
  if (typeof data === 'object') {
    content.message = data.message || JSON.stringify(data);
    content.code = data.code || -1;
  } else if (typeof data === 'string') {
    content.message = data;
  }
  res.status(httpCode).send(content);
};

module.exports = app => {
  app.use(bodyParser.urlencoded({
    extended: true
  }));

  app.use(bodyParser.json());

  app.get('/node*', forbidden);
  app.get('/api.js', forbidden);

  app.get('/files', async (req, res) => {
    try {
      res.send(await Api.fileList());
    } catch (error) {
      sendError(res, 500, error);
    }
  });

  app.get('/files/*', (req, res) => {
    try {
      const fullpath = req.params[0];
      const file = `${fullpath}`;
      res.download(file);
    } catch (error) {
      sendError(res, 500, error);
    }
  });

  app.delete('/files/*', (req, res) => {
    try {
      const fullpath = req.params[0];
      res.send(Api.fileDelete(fullpath));
    } catch (error) {
      sendError(res, 500, error);
    }
  });

  app.post('/scan', async (req, res) => {
    const param = req.body;
    try {
      res.send(await Api.scan(param));
    } catch (error) {
      sendError(res, 500, error);
    }
  });

  app.get('/preview', async (req, res) => {
    try {
      const buffer = await Api.readPreview();
      res.send({
        content: buffer.toString('base64')
      });
    } catch (error) {
      sendError(res, 500, error);
    }
  });

  app.post('/preview', async (req, res) => {
    const param = req.body;
    try {
      res.send(await Api.createPreview(param));
    } catch (error) {
      sendError(res, 500, error);
    }
  });

  app.get(['/context', '/context/:force'], async (req, res) => {
    const force = req.params.force && req.params.force === 'force';
    try {
      res.send(await Api.context(force));
    } catch (error) {
      sendError(res, 500, error);
    }
  });

  app.use(bodyParser.json());
};
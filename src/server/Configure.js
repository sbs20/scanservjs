const bodyParser = require('body-parser');
const Api = require('./Api');

const forbidden = function (req, res) {
  res.status(403).send('<h1>Error 403: Forbidden</h1>');
};

const wrapError = function (err) {
  return {
    message: err.message,
    code: err.code
  };
};

module.exports = app => {
  app.use(bodyParser.urlencoded({
    extended: true
  }));

  app.use(bodyParser.json());

  app.get('/node*', forbidden);
  app.get('/api.js', forbidden);

  app.get('/files', async (req, res) => {
    res.send(await Api.fileList());
  });

  app.get('/files/*', (req, res) => {
    const fullpath = req.params[0];
    const file = `${fullpath}`;
    res.download(file);
  });

  app.delete('/files/*', (req, res) => {
    const fullpath = req.params[0];
    res.send(Api.fileDelete(fullpath));
  });

  app.get('/ping', (req, res) => {
    res.send('Pong@' + new Date().toISOString());
  });

  app.post('/convert', async (req, res) => {
    try {
      const fileInfo = await Api.convert();
      fileInfo.content = fileInfo.toBase64();
      res.send(fileInfo);
    } catch (error) {
      const err = wrapError(error);
      res.status(500).send(err);
    }
  });

  app.post('/scan', async (req, res) => {
    const param = req.body;
    try {
      res.send(await Api.scan(param));
    } catch (error) {
      const err = wrapError(error);
      res.status(500).send(err);
    }
  });

  app.post('/preview', async (req, res) => {
    const param = req.body;
    try {
      res.send(await Api.preview(param));
    } catch (error) {
      const err = wrapError(error);
      res.status(500).send(err);
    }
  });

  app.get('/diagnostics', (req, res) => {
    res.send(Api.diagnostics());
  });

  app.get('/device', async (req, res) => {
    try {
      res.send(await Api.device());
    } catch (error) {
      const err = wrapError(error);
      res.status(500).send(err);
    }
  });

  app.use(bodyParser.json());
};
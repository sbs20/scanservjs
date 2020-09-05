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

  app.get('/files', (req, res) => {
    const api = new Api();
    api.fileList().then((reply) => {
      res.send(reply);
    });
  });

  app.get('/files/*', (req, res) => {
    const fullpath = req.params[0];
    const file = `${fullpath}`;
    res.download(file);
  });

  app.delete('/files/*', (req, res) => {
    const fullpath = req.params[0];
    const api = new Api();
    api.fileDelete({ data: fullpath }).then((reply) => {
      res.send(reply);
    });
  });

  app.get('/ping', (req, res) => {
    res.send('Pong@' + new Date().toISOString());
  });

  app.post('/convert', (req, res) => {
    const api = new Api();
    api.convert()
      .then((fileInfo) => {
        fileInfo.content = fileInfo.toBase64();
        res.send(fileInfo);
      })
      .fail((data) => {
        const err = wrapError(data);
        res.status(500).send(err);
      });
  });

  app.post('/scan', (req, res) => {
    const param = req.body;
    const api = new Api();
    api.scan(param)
      .then((data) => {
        res.send(data);
      })
      .fail((data) => {
        const err = wrapError(data);
        res.status(500).send(err);
      });
  });

  app.post('/preview', (req, res) => {
    const param = req.body;
    const api = new Api();
    api.preview(param)
      .then((data) => {
        res.send(data);
      })
      .fail((data) => {
        const err = wrapError(data);
        res.status(500).send(err);
      });
  });

  app.get('/diagnostics', (req, res) => {
    const api = new Api();
    api.diagnostics()
      .then((tests) => {
        res.send(tests);
      });
  });

  app.get('/device', (req, res) => {
    const api = new Api();
    api.device()
      .then((data) => {
        res.send(data);
      })
      .fail((data) => {
        const err = wrapError(data);
        res.status(500).send(err);
      });
  });

  app.use(bodyParser.json());
};
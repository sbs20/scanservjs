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
    Api.fileList().then((reply) => {
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
    Api.fileDelete({ data: fullpath }).then((reply) => {
      res.send(reply);
    });
  });

  app.get('/ping', (req, res) => {
    res.send('Pong@' + new Date().toISOString());
  });

  app.post('/convert', (req, res) => {
    Api.convert()
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
    Api.scan(param)
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
    Api.preview(param)
      .then((data) => {
        res.send(data);
      })
      .fail((data) => {
        const err = wrapError(data);
        res.status(500).send(err);
      });
  });

  app.get('/diagnostics', (req, res) => {
    Api.diagnostics()
      .then((tests) => {
        res.send(tests);
      });
  });

  app.get('/device', (req, res) => {
    Api.device()
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
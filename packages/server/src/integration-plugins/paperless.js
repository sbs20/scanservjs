const log = require('loglevel').getLogger('Scan');

const http = require('http');
const https = require('https');
const fs = require('fs');

const BasePlugin = require('./base');


class Paperless {

  constructor({hostname, token, use_https, port}) {
    this.hostname = hostname;
    this.token = token;
    if (use_https === false) {
      this.http = http;
      this.port = port || 80;
    } else {
      this.http = https;
      this.port = port || 443;
    }
  }

  upload(filename) {
    // https://paperless-ngx.readthedocs.io/en/latest/api.html#posting-documents
    const options = {
      hostname: this.hostname,
      port: 443,
      path: '/api/documents/post_document/',
      method: 'POST',
      headers: {
        //'Content-Type': '',
      },
    };

    const req = this.http.request(options, (res) => {
      log.debug(`STATUS: ${res.statusCode}`);
      log(`HEADERS: ${JSON.stringify(res.headers)}`);
      res.setEncoding('utf8');

    });
    const form = req.form();
    form.append('file', fs.createReadStream(filename));

    req.on('error', (e) => {
      log.error(`Paperless request failed: ${e.message}`);
    });
    return req.end();
  }

}


class PaperlessPlugin extends BasePlugin {
  name() {
    return 'paperless';
  }
  onScan(fileInfo) {
    const paperless = Paperless({
      hostname: this.pluginconfig.hostname,
      port: this.pluginconfig.port,
      use_https: this.pluginconfig.use_https,
      token: this.pluginsecret.token
    });
    paperless.upload(fileInfo.fullname);
  }

}

module.exports = PaperlessPlugin;

const Q = require('kew');
const Config = require('./Config');
const System = require('./System');

class Convert {
  constructor(arg) {
    this.args = System.extend({
      source: undefined,
      target: undefined,
      normalize: false,
      trim: false,
      sharpen: 0,
      quality: undefined,
      ignoreStdError: false
    }, arg);
  }

  cmd() {
    let params = ' ';
    if (this.args.ignoreStdError) params += Config.IgnoreStdError + ' ';
    if (this.args.normalize) params += '-normalize ';
    if (this.args.trim) params += '-trim ';
    if (this.args.sharpen) params += '-sharpen ' + this.args.sharpen + ' ';
    if (this.args.quality) params += '-quality ' + this.args.quality + ' ';

    return Config.Convert + ' ' +
      params +
      this.args.source + ' ' +
      this.args.target;
  }

  // Returns a promise
  execute() {
    const cmd = this.cmd();
    return System.execute(cmd)
      .fail((error) => {
        // Incomplete scan images are corrupt and will throw an error like
        // convert: Read error on strip 23; got 3343 bytes, expected 8037. `TIFFFillStrip'
        // We can just ignore that and resolve as there will be an output file
        if (error.message.indexOf('TIFFFillStrip') !== -1) {
          return Q.resolve();
        }

        // If it's something else then reject
        return Q.reject(error);
      });
  }
}

module.exports = Convert;
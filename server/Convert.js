const CmdBuilder = require('./CmdBuilder');
const Config = require('../config/config');
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
    const cmdBuilder = new CmdBuilder(Config.convert);
    if (this.args.normalize) {
      cmdBuilder.arg('-normalize');
    }
    if (this.args.trim) {
      cmdBuilder.arg('-trim');
    }
    if (this.args.sharpen) {
      cmdBuilder.arg('-sharpen', this.args.sharpen);
    }
    if (this.args.quality) {
      cmdBuilder.arg('-quality', this.args.quality);
    }
    return cmdBuilder
      .arg(this.args.source)
      .arg(this.args.target)
      .build(this.args.ignoreStdError);
  }

  // Returns a promise
  async execute() {
    const cmd = this.cmd();
    try {
      return await System.execute(cmd);
    } catch (error) {
      // Incomplete scan images are corrupt and will throw an error like
      // convert: Read error on strip 23; got 3343 bytes, expected 8037. `TIFFFillStrip'
      // Ignore these
      const ignores = [
        'TIFFFillStrip',
        'Cannot read TIFF header'
      ];

      for (let ignore of ignores) {
        if (error.message.indexOf(ignore) !== -1) {
          return null;
        }  
      }
      
      throw error;
    }
  }
}

module.exports = Convert;
const CmdBuilder = require('./CmdBuilder');
const Constants = require('./Constants');
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
    const cmdBuilder = new CmdBuilder(Constants.Convert);
    if (this.args.ignoreStdError) {
      cmdBuilder.arg(Constants.IgnoreStdError);
    }
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
      .build();
  }

  // Returns a promise
  async execute() {
    const cmd = this.cmd();
    try {
      return await System.execute(cmd);
    } catch (error) {
      // Incomplete scan images are corrupt and will throw an error like
      // convert: Read error on strip 23; got 3343 bytes, expected 8037. `TIFFFillStrip'
      // We can just ignore that and resolve as there will be an output file
      if (error.message.indexOf('TIFFFillStrip') !== -1) {
        return null;
      }

      throw error;
    }
  }
}

module.exports = Convert;
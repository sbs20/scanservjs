const rootLog = require('loglevel');

const MAX_ENTRIES = 200;

class LogBuffer {
  constructor() {
    this.entries = [];
    this._installed = false;
  }

  install() {
    if (this._installed) return;
    this._installed = true;

    const originalFactory = rootLog.methodFactory;
    const self = this;

    rootLog.methodFactory = function (methodName, logLevel, loggerName) {
      const rawMethod = originalFactory(methodName, logLevel, loggerName);
      return function (...args) {
        self._capture(methodName, loggerName, args);
        rawMethod.apply(this, args);
      };
    };

    // Re-apply current level to trigger methodFactory rebuild
    rootLog.setLevel(rootLog.getLevel());
  }

  _capture(level, logger, args) {
    const message = args.map(a =>
      typeof a === 'string' ? a : (a instanceof Error ? a.message : JSON.stringify(a))
    ).join(' ');

    this.entries.push({
      timestamp: new Date().toISOString(),
      level,
      logger: logger || '',
      message
    });

    if (this.entries.length > MAX_ENTRIES) {
      this.entries.splice(0, this.entries.length - MAX_ENTRIES);
    }
  }

  getEntries() {
    return this.entries.slice();
  }

  clear() {
    this.entries = [];
  }
}

module.exports = new LogBuffer();

const Config = {
  log: {
    level: 'DEBUG',
    prefix: {
      template: '[%t] %l (%n):',
      levelFormatter(level) {
        return level.toUpperCase();
      },
      nameFormatter(name) {
        return name || 'global';
      },
      timestampFormatter(date) {
        return date.toISOString();
      },
    }
  }
};

module.exports = Config;

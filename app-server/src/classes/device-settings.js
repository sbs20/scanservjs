module.exports = class DeviceSettings {
  constructor(config) {
    Object.assign(this, {
      batchMode: {
        options: config.batchModes,
        default: config.batchModes[0]
      },
      filters: {
        options: config.filters.map(f => f.description),
        default: []
      },
      pipeline: {
        options: config.pipelines.map(p => p.description),
        default: config.pipelines[0].description
      }
    });
  }
};

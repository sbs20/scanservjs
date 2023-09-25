const os = require('os');
const Process = require('./process');
const FileInfo = require('./file-info');

const ContainerTypes = {
  NONE: 'none',
  DOCKER: 'docker',
  PODMAN: 'podman',
  SYSTEMD_NSPAWN: 'systemd-nspawn'
};

/**
 * @returns {Promise<string>} The detected npm version
 */
async function getNpmVersion() {
  try {
    const buffer = await Process.spawn('npm -v');
    return buffer.toString().trim();
  } catch (error) {
    return 'Failed to determine';
  }
}

/**
 * @returns {'docker' | 'podman' | 'systemd-nspawn' | null>} The used container technology, or null if no container was detected.
 */
function getContainerType() {
  if (FileInfo.unsafe('/.dockerenv').exists()) {
    return ContainerTypes.DOCKER;
  }

  if (FileInfo.unsafe('/run/.containerenv').exists()) {
    return ContainerTypes.PODMAN;
  }

  const containerManager = FileInfo.unsafe('/run/host/container-manager');
  if (containerManager.exists() && containerManager.toText() === ContainerTypes.SYSTEMD_NSPAWN) {
    return ContainerTypes.SYSTEMD_NSPAWN;
  }

  return ContainerTypes.NONE;
}

module.exports = new class System {

  constructor() {
    this.npmVersion = null;
    this.containerType = null;
  }

  /**
   * @returns {Promise.<SystemInfo>}
   */
  async info() {
    if (this.containerType === null) {
      this.containerType = getContainerType();
    }

    if (this.npmVersion === null) {
      this.npmVersion = await getNpmVersion();
    }

    const info = {
      os: {
        arch: os.arch(),
        freemem: Math.floor(os.freemem() / (1024 * 1024)),
        platform: os.platform(),
        release: os.release(),
        type: os.type()
      },
      node: process.version,
      npm: this.npmVersion,
      containerType: this.containerType,
    };

    try {
      info.os.version = os.version();
    } catch (e) {
      info.os.version = 'Unavailable';
    }

    return info;
  }
};

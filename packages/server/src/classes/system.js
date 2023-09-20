const os = require('os');
const fs = require('fs/promises');
const Process = require('./process');

// Detect npm version and container type and cache them here
const npmVersion = getNpmVersion();
const containerType = detectContainerType();

module.exports = class System {
  /**
   * @returns {Promise.<SystemInfo>}
   */
  async info() {
    const container = await containerType;
    const info = {
      os: {
        arch: os.arch(),
        freemem: Math.floor(os.freemem() / (1024 * 1024)),
        platform: os.platform(),
        release: os.release(),
        type: os.type()
      },
      node: process.version,
      npm: await npmVersion,
      docker: container === "docker",
      containerType: container,
    };

    try {
      info.os.version = os.version();
    } catch (e) {
      info.os.version = 'Unavailable';
    }

    return info;
  }
};

/**
 * @returns {Promise<string | null>} The detected npm version, or null, if detection failed.
 */
async function getNpmVersion() {
  try {
    const proc = await Process.spawn('npm -v');
    return proc.toString().trim();
  } catch (error) {
    console.error("Failed to determine npm version", error);
    return null;
  }
}

/**
 * @returns {Promise<'docker' | 'podman' | 'systemd-nspawn' | null>} The used container technology, or null if no container was detected.
 */
async function detectContainerType() {
  try {
    // Detect docker by the /.dockerenv file
    await fs.stat('/.dockerenv');
    return 'docker';
  } catch (_) {}

  try {
    // Detect podman by the /run/.containerenv file
    await fs.stat('/run/.containerenv');
    return 'podman';
  } catch (_) {}

  try {
    // Detect systemd-nspawn by the /run/host/container-manager file
    const manager = await fs.readFile("/run/host/container-manager", 'utf-8');
    if (manager === 'systemd-nspawn') {
      return 'systemd-nspawn';
    }
  } catch (_) {}

  return null;
}


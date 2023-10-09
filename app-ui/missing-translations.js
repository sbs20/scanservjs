const fs = require('fs');

const EXCLUDED_KEY = ['locales'];
const BASE = 'en.json';

function missingKeys(o1, o2) {
  return Object.keys(o1)
    .filter(k => !EXCLUDED_KEY.some(ex => ex === k))
    .flatMap(k => {
      return (!(k in o2))
        ? [k]
        : typeof o2[k] === 'object'
        ? missingKeys(o1[k], o2[k]).map(s => `${k}.${s}`)
        : [];
    });
}

const locales = new class Locales {
  constructor(path) {
    this.path = path || 'src/locales';
  }

  /**
   * @returns {Promise.<string[]>}
   */
  async list() {
    return await new Promise((resolve, reject) => {
      fs.readdir(this.path, (err, list) => {
        if (err) {
          reject(err);
        }
        resolve(list);
      });
    });
  }

  /**
   * @returns {Promise.<object[]>}
   */
  async all() {
    if (this._all === undefined) {
      this._all = (await this.list())
        .map(s => ({
          key: s,
          data: require(`./${this.path}/${s}`)
        }));
    }
    return this._all;
  }

  /**
   * @returns {Promise.<object>}
   */
  async base() {
    return (await this.all()).filter(l => l.key === BASE)[0];
  }

  /**
   * @returns {Promise.<object[]>}
   */
  async children() {
    return (await this.all()).filter(l => l.key !== BASE);
  }
};

async function main() {
  const en = await locales.base();
  const children = await locales.children();
  const report = children
    .map(child => ({
      key: child.key,
      missing: missingKeys(en.data, child.data)
    }));
  console.log(JSON.stringify(report));
}

main();

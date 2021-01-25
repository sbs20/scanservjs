export default {
  async fetch(url, options) {
    const response = await fetch(url, options);
    const json = await response.json();
    if (response.ok) {
      return json;
    }
    throw json;
  },

  clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  },

  version() {
    return process.env.VUE_APP_VERSION;
  }
};

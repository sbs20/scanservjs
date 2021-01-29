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

  round(n, dp) {
    const f = Math.pow(10, dp || 0);
    return Math.round(n * f) / f;
  }
};

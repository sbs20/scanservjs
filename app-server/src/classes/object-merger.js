const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function deepMerge(...objects) {
  return objects.reduce((acc, cur) => {
    return typeof cur === 'undefined' ? acc :
      Array.isArray(cur) || typeof cur !== 'object' ? cur :
      Object.entries(cur).reduce((acc, kv) => {
        const [key, value] = kv;
        if (DANGEROUS_KEYS.has(key)) {
          return acc;
        }
        acc[key] = key in acc ? deepMerge(acc[key], value) : value;
        return acc;
      }, acc);
  });
}

module.exports = new class ObjectMerger {
  deepMerge(...objects) {
    return deepMerge(...objects);
  }
};

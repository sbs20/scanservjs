function deepMerge(...objects) {
  return objects.reduce((acc, cur) => {
    return typeof cur === 'undefined' ? acc :
      Array.isArray(cur) || typeof cur !== 'object' ? cur :
      Object.entries(cur).reduce((acc, kv) => {
        const [key, value] = kv;
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

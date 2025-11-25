const fs = require('fs');
const path = require('path');
const semver = require('semver');

function findPackageJsons(dir='.') {
  const res = [];
  function walk(d) {
    for (const f of fs.readdirSync(d)) {
        
      const p = path.join(d,f);
      if (f === 'node_modules') continue;
      const stat = fs.statSync(p);
      if (stat.isDirectory()) walk(p);
      else if (f === 'package.json') res.push(p);
    }
  }
  walk(dir);
  return res;
}

const pkgs = findPackageJsons('.');
const versions = [];
var count = 0;
for (const p of pkgs) {
    count++;
  try {
    const pj = JSON.parse(fs.readFileSync(p,'utf8'));
    const eng = pj.engines && pj.engines.node;
    if (eng) {
      const min = semver.minVersion(eng);
      if (min) versions.push({pkg:p, range:eng, min:min.version});
    }
  } catch(e){}
}
console.log("number of pkgs found %d", count)
if (!versions.length) return console.log('No engines.node found in any package.json');
versions.sort((a,b)=>semver.compare(a.min,b.min));
console.table(versions);
console.log('Overall minimum Node.js version required:', versions[0].min);
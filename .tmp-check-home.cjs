const fs = require('fs');
for (const file of ['public/home.html']) {
  const s = fs.readFileSync(file,'utf8');
  const scripts = [...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  for (const [i, code] of scripts.entries()) {
    try { new Function(code); console.log(file, 'script', i, 'ok'); }
    catch (e) { console.error(file, 'script', i, 'ERR', e.message); process.exitCode = 1; }
  }
}

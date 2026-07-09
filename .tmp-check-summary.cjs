const fs = require('fs');
const s = fs.readFileSync('public/summary.html','utf8');
const scripts = [...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
for (const [i, code] of scripts.entries()) {
  try { new Function(code); console.log('script', i, 'ok'); }
  catch (e) { console.error('script', i, 'ERR', e.message); process.exitCode = 1; }
}

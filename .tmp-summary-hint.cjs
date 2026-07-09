const fs = require('fs');
const path = 'public/summary.html';
let s = fs.readFileSync(path, 'utf8');
s = s.replace(/\$\('#filterHint'\)\.textContent = .*?;\n  const stats = \[/s, "$('#filterHint').textContent = (activeLevel ? '当前筛选：' + activeLevel : '全部员工') + (searchQuery ? ' · 搜索：' + searchQuery : '');\n  const stats = [");
fs.writeFileSync(path, s, 'utf8');
console.log(s.includes('搜索：'));

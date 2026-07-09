const fs = require('fs');
const path = 'public/summary.html';
let s = fs.readFileSync(path, 'utf8');
if (!s.includes('id="summarySearch"')) {
  s = s.replace('<select id="levelFilter"></select>\n      <button class="secondary" id="clearFilter">', '<select id="levelFilter"></select>\n      <input id="summarySearch" class="summary-search" type="search" placeholder="搜索姓名 / 部门 / 岗位">\n      <button class="secondary" id="clearFilter">');
}
if (!s.includes('let searchQuery =')) {
  s = s.replace("let activeLevel = '';\nlet expandedBox", "let activeLevel = '';\nlet searchQuery = '';\nlet expandedBox");
}
if (!s.includes('function searchableText')) {
  s = s.replace('function filteredRows(){\n  return activeLevel ? rows.filter(row => levelOf(row) === activeLevel) : rows;\n}', `function searchableText(row){\n  const fields = row.fields || {};\n  return [row.name, row.department, row.role, levelOf(row), row.id, ...Object.values(fields)].map(value => String(value ?? '').toLowerCase()).join(' ');\n}\n\nfunction filteredRows(){\n  const keyword = searchQuery.trim().toLowerCase();\n  return rows.filter(row => {\n    const levelOk = !activeLevel || levelOf(row) === activeLevel;\n    const searchOk = !keyword || searchableText(row).includes(keyword);\n    return levelOk && searchOk;\n  });\n}`);
}
if (!s.includes("$('#summarySearch').oninput")) {
  s = s.replace("$('#levelFilter').onchange = event => { activeLevel = event.target.value; render(); };\n$('#clearFilter').onclick = () => { activeLevel = ''; render(); };", "$('#levelFilter').onchange = event => { activeLevel = event.target.value; render(); };\n$('#summarySearch').oninput = event => { searchQuery = event.target.value; render(); };\n$('#clearFilter').onclick = () => { activeLevel = ''; searchQuery = ''; $('#summarySearch').value = ''; render(); };");
}
if (!s.includes('searchQuery ?')) {
  s = s.replace("$('#filterHint').textContent = activeLevel ? '褰撳墠绛涢€夛細' + activeLevel : '鍏ㄩ儴鍛樺伐';", "$('#filterHint').textContent = (activeLevel ? '当前筛选：' + activeLevel : '全部员工') + (searchQuery ? ' · 搜索：' + searchQuery : '');");
}
fs.writeFileSync(path, s, 'utf8');

const cssPath = 'public/styles.css';
let css = fs.readFileSync(cssPath, 'utf8');
if (!css.includes('.summary-search')) {
  css += `\n/* Summary search */\n.summary-search{min-width:220px;border:1px solid #dfe5ef;border-radius:12px;background:#fff;padding:11px 12px;font-weight:700;color:#172034}.summary-search::placeholder{color:#9aa3b5;font-weight:600}@media(max-width:720px){.summary-search{width:100%;min-width:0}.summary-filter-card .initial-filter-controls{display:grid;grid-template-columns:1fr}.summary-filter-card .initial-filter-controls button{width:100%}}\n`;
  fs.writeFileSync(cssPath, css, 'utf8');
}
console.log('done', s.includes('summarySearch'), s.includes('searchableText'));

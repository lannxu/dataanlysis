const fs = require('fs');
const path = 'public/admin.html';
let s = fs.readFileSync(path, 'utf8');
s = s.replace(
  "$('#hostDecisionBar').innerHTML =\n    '<div><span>讨论结果</span><b>' + esc(decisionText(row)) + '</b></div>' +\n    '<div class=\"decision-controls current-decision\">' +",
  "$('#hostDecisionBar').innerHTML =\n    '<div><span>系统建议</span><b>' + esc(recommendationText(row)) + '</b></div>' +\n    '<div><span>讨论结果</span><b>' + esc(decisionText(row)) + '</b></div>' +\n    '<div class=\"decision-controls current-decision\">' +"
);
fs.writeFileSync(path, s, 'utf8');

const cssPath = 'public/styles.css';
let css = fs.readFileSync(cssPath, 'utf8');
const block = `\n/* Put system recommendation next to discussion result in host admin */\n#hostRecommend{display:none!important}#hostDecisionBar{grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto}#hostDecisionBar>div:first-child{background:#edf2ff;border:1px solid #d9e2ff;border-radius:12px;padding:8px 10px}#hostDecisionBar>div:nth-child(2){background:#fff;border:1px solid #e7ebf2;border-radius:12px;padding:8px 10px}@media(max-width:1120px){#hostDecisionBar{grid-template-columns:1fr}#hostDecisionBar .decision-controls{grid-template-columns:1fr 1fr}#hostDecisionBar .decision-controls select{grid-column:1/3}}\n`;
if (!css.includes('Put system recommendation next to discussion result')) css += block;
fs.writeFileSync(cssPath, css, 'utf8');
console.log('ok', s.includes('<div><span>系统建议</span><b>'), css.includes('#hostDecisionBar'));

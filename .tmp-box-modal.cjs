const fs = require('fs');
const path = 'public/summary.html';
let s = fs.readFileSync(path, 'utf8');
if (!s.includes('id="boxModal"')) {
  s = s.replace('</main>\n\n<script>', `</main>\n\n<div class="box-modal" id="boxModal" hidden onclick="if(event.target===this) closeBoxModal()">\n  <div class="box-modal-panel" role="dialog" aria-modal="true" aria-labelledby="boxModalTitle">\n    <div class="box-modal-head">\n      <div>\n        <h2 id="boxModalTitle">Box</h2>\n        <p class="muted" id="boxModalCount"></p>\n      </div>\n      <button class="secondary" onclick="closeBoxModal()">关闭</button>\n    </div>\n    <div class="box-modal-list" id="boxModalList"></div>\n  </div>\n</div>\n\n<script>`);
}
if (!s.includes('let expandedBox = null;')) {
  s = s.replace('let rows = [];\nlet activeLevel = \'\';', 'let rows = [];\nlet activeLevel = \'\';\nlet expandedBox = null;');
}
if (!s.includes('function membersOfBox')) {
  s = s.replace('function chooseGrid(employeeId, current){', `function membersOfBox(box){\n  return filteredRows().filter(row => row.decision?.type === 'direct' && row.decision.grid === box);\n}\n\nfunction openBoxModal(box){\n  expandedBox = box;\n  const members = membersOfBox(box);\n  $('#boxModalTitle').textContent = 'Box ' + box;\n  $('#boxModalCount').textContent = members.length + ' 人，点击姓名可调整落位';\n  $('#boxModalList').innerHTML = members.length ? members.map(row => '<button class="box-modal-person" onclick="chooseGrid(decodeURIComponent(\\'' + encodeURIComponent(row.id) + '\\'),' + row.decision.grid + '); closeBoxModal();"><span>' + esc(row.name) + '</span></button>').join('') : '<div class="empty">这个 Box 暂时没有人员</div>';\n  $('#boxModal').hidden = false;\n  document.body.classList.add('modal-open');\n}\n\nfunction closeBoxModal(){\n  expandedBox = null;\n  $('#boxModal').hidden = true;\n  document.body.classList.remove('modal-open');\n}\n\ndocument.addEventListener('keydown', event => {\n  if (event.key === 'Escape' && !$('#boxModal').hidden) closeBoxModal();\n});\n\nfunction chooseGrid(employeeId, current){`);
}
s = s.replace(
  `return '<div class="nine-cell cell-' + box + '" ondragover="event.preventDefault()" ondrop="dropTo(event,' + box + ')"><div class="cell-title"><b>Box ' + box + '</b><span>' + members.length + ' 浜?路 ' + pct(members.length, list.length) + '</span></div><div class="cell-people">' +`,
  `return '<div class="nine-cell cell-' + box + ' box-zoomable" title="点击放大 Box ' + box + '" onclick="openBoxModal(' + box + ')" ondragover="event.preventDefault()" ondrop="dropTo(event,' + box + ')"><div class="cell-title"><b>Box ' + box + '</b><span>' + members.length + ' 浜?路 ' + pct(members.length, list.length) + '</span></div><div class="cell-people">' +`
);
s = s.replace(
  `onclick="chooseGrid(decodeURIComponent(\\'' + encodeURIComponent(row.id) + '\\'),' + row.decision.grid + ')"`,
  `onclick="event.stopPropagation();chooseGrid(decodeURIComponent(\\'' + encodeURIComponent(row.id) + '\\'),' + row.decision.grid + ')"`
);
fs.writeFileSync(path, s, 'utf8');

const cssPath = 'public/styles.css';
let css = fs.readFileSync(cssPath, 'utf8');
if (!css.includes('.box-modal{')) {
  css += `\n/* Fullscreen Box viewer */\n.box-zoomable{cursor:zoom-in}.box-modal[hidden]{display:none!important}.box-modal{position:fixed;inset:0;z-index:9999;background:rgba(12,20,38,.68);padding:22px;display:grid;place-items:center}.box-modal-panel{width:min(1040px,96vw);height:min(760px,92vh);background:#fff;border-radius:24px;box-shadow:0 28px 80px rgba(8,16,36,.35);padding:24px;display:grid;grid-template-rows:auto minmax(0,1fr);gap:16px}.box-modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.box-modal-head h2{font-size:34px;margin:0 0 4px}.box-modal-head p{margin:0}.box-modal-list{min-height:0;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:12px;align-content:start;padding:2px}.box-modal-person{appearance:none;border:1px solid #e5eaf2;background:#f8fafd;color:#172034;border-radius:16px;padding:16px 14px;min-height:64px;font:inherit;font-weight:900;text-align:center;cursor:pointer}.box-modal-person:hover{border-color:#2457e6;background:#edf2ff;color:#2457e6}.modal-open{overflow:hidden}@media(max-width:640px){.box-modal{padding:12px}.box-modal-panel{height:94vh;border-radius:18px;padding:16px}.box-modal-head h2{font-size:26px}.box-modal-list{grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px}.box-modal-person{padding:12px 8px;min-height:54px}}\n`;
  fs.writeFileSync(cssPath, css, 'utf8');
}

const fs = require('fs');
const path = 'public/summary.html';
let s = fs.readFileSync(path, 'utf8');
s = s.replace(
  /return '<div class="nine-cell cell-' \+ box \+ '" ondragover="event\.preventDefault\(\)" ondrop="dropTo\(event,' \+ box \+ '\)">/,
  `return '<div class="nine-cell cell-' + box + ' box-zoomable" title="点击放大 Box ' + box + '" onclick="openBoxModal(' + box + ')" ondragover="event.preventDefault()" ondrop="dropTo(event,' + box + ')">`
);
fs.writeFileSync(path, s, 'utf8');
console.log(/openBoxModal\(' \+ box \+ '\)/.test(s), s.includes('box-zoomable'));

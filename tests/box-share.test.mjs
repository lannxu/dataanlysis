import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function kpis(file, name, rows) {
  const source = readFileSync(new URL('../public/' + file, import.meta.url), 'utf8');
  const start = source.indexOf('function ' + name + '(){');
  const end = source.indexOf("  $('#kpis').innerHTML", start);
  const nodes = {};
  return vm.runInNewContext(source.slice(start, end) + 'return stats; } ' + name + '()', {
    renderFilter() {}, filteredRows: () => rows, activeBoxes: new Set(), activeLevel: '', searchQuery: '',
    $: selector => nodes[selector] ||= {},
    pct: (n, total) => total ? Math.round(n / total * 100) + '%' : '0%',
    placementGrid: row => row.decision?.grid || row.recommendedGrid
  });
}
for (const [file, name] of [['summary.html', 'render'], ['initial-results.html', 'renderGroup']]) {
  test(file + ' shows adjacent Box shares and removes cumulative votes', () => {
    const rows = [
      {count: 2, decision: {type: 'direct', grid: 1}},
      {count: 1, decision: {type: 'direct', grid: 7}},
      {count: 3, recommendedGrid: 8},
      {count: 1, recommendedGrid: 9, decision: {type: 'pending'}}
    ];
    const stats = kpis(file, name, rows);
    assert.equal(stats.length, 7);
    assert.equal(stats[5][0], 'Box 1/2/3 整体比例');
    assert.equal(stats[5][1], '25%');
    assert.equal(stats[6][0], 'Box 7/8/9 整体比例');
    assert.equal(stats[6][1], file === 'summary.html' ? '25%' : '50%');
    assert.ok(stats.every(([label]) => !label.includes('累计')));
    assert.equal(kpis(file, name, [])[6][1], '0%');
  });
}

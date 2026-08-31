const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const vm = require('node:vm');

test('host grid shows names only in their voted box and escapes user input', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8');
  const code = html.slice(html.indexOf('function renderCurrentViews(){'), html.indexOf('function wireDiscussionNote(){'));
  const elements = new Map();
  const row = { id: 'E1', name: 'Employee', fields: {}, count: 3, gridCounts: [1,0,0,0,2,0,0,0,0], voteDetails: [
    { evaluatorName: 'Evaluator A', grid: 5 },
    { evaluatorName: '<Test B>', grid: 1 },
    { evaluatorName: '', grid: 5 }
  ] };
  const context = {
    currentResult: () => row, state: { employee: row }, boxes: [1,2,3,4,5,6,7,8,9], gridOrder: [6,3,1,8,5,2,9,7,4],
    $: selector => { if (!elements.has(selector)) elements.set(selector, {}); return elements.get(selector); },
    esc: value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])),
    discussionNoteFields: [], voteSummaryText: () => '', recommendationText: () => '', decisionText: () => '',
    updateVoteAxisBands: () => {}, wireDiscussionNote: () => {}, gridOptions: () => '', uiText: zh => zh, pct: () => ''
  };
  vm.runInNewContext(code + '\nrenderCurrentViews();', context);
  const grid = elements.get('#hostNineGrid').innerHTML;
  const box5 = grid.split('stage-nine-cell cell-5')[1].split('stage-nine-cell')[0];
  const box1 = grid.split('stage-nine-cell cell-1')[1].split('stage-nine-cell')[0];
  assert.ok(box5.includes('Evaluator A'));
  assert.ok(box5.includes('未署名评委'));
  assert.ok(!box1.includes('Evaluator A'));
  assert.ok(box1.includes('&lt;Test B&gt;'));
  assert.ok(!grid.includes('<Test B>'));
});

test('initial person grid supports online and imported reviewers without showing skipped votes', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'initial-results.html'), 'utf8');
  const code = html.slice(html.indexOf('function renderPerson(){'), html.indexOf('function wirePersonDiscussionNote(row){'));
  const elements = new Map();
  const row = { id:'E1', name:'Employee', fields:{}, count:2, gridCounts:[0,0,0,0,2,0,0,0,0], voteDetails:[
    { evaluatorName:'Online Reviewer', grid:5 },
    { evaluator:'Imported <Reviewer>', source:'excel', grid:5 },
    { evaluatorName:'Skipped Reviewer', skip:true, grid:5 }
  ] };
  vm.runInNewContext(code + '\nrenderPerson();', {
    currentPerson: () => row, renderPersonPicker: () => {}, boxes:[1,2,3,4,5,6,7,8,9], gridOrder:[6,3,1,8,5,2,9,7,4],
    $: selector => { if(!elements.has(selector)) elements.set(selector,{}); return elements.get(selector); },
    esc: value => String(value ?? '').replaceAll('<','&lt;').replaceAll('>','&gt;'),
    discussionNoteFields:[], levelOf:()=>'', voteSummaryText:()=>'', recommendationText:()=>'', placementText:()=>'',
    updateVoteAxisBands:()=>{}, wirePersonDiscussionNote:()=>{}, gridOptions:()=>'', pct:()=>''
  });
  const grid = elements.get('#personNineGrid').innerHTML;
  const box5 = grid.split('stage-nine-cell cell-5')[1].split('stage-nine-cell')[0];
  assert.ok(box5.includes('Online Reviewer'));
  assert.ok(box5.includes('Imported &lt;Reviewer&gt;'));
  assert.ok(!grid.includes('Skipped Reviewer'));
});

test('live evaluator names persist, move boxes, and remain separate from initial votes', async () => {
  const root = path.resolve(__dirname, '..');
  const parent = path.join(root, 'tmp');
  fs.mkdirSync(parent, { recursive: true });
  const dir = fs.mkdtempSync(path.join(parent, 'live-evaluator-'));
  fs.copyFileSync(path.join(root, 'server.mjs'), path.join(dir, 'server.mjs'));
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: dir, env: { ...process.env, PORT: '0', LISTEN_HOST: '127.0.0.1', PUBLIC_URL: '' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let cookie = '';
  try {
    const base = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Server startup timed out')), 10000);
      child.once('error', reject);
      child.stdout.on('data', chunk => {
        const match = String(chunk).match(/http:\/\/localhost:(\d+)\/admin/);
        if (match) { clearTimeout(timer); resolve('http://127.0.0.1:' + match[1]); }
      });
    });
    const request = async (url, body) => {
      const response = await fetch(base + url, {
        method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: body ? JSON.stringify(body) : undefined
      });
      if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
      assert.equal(response.status, 200, await response.clone().text());
      return response.json();
    };
    await request('/api/auth/setup', { username: 'test-admin', password: 'isolated-test-password' });
    await request('/api/employees', { employees: [{ id: 'E1', name: 'Test Employee' }] });
    await request('/api/vote', { evaluatorId: 'device-a', evaluatorName: 'Evaluator A', employeeId: 'E1', pl: 3, pot: 2 });
    let row = (await request('/api/results'))[0];
    assert.equal(row.count, 1);
    assert.equal(row.voteDetails[0].grid, 5);
    assert.equal(row.voteDetails[0].evaluatorName, 'Evaluator A');
    await request('/api/vote', { evaluatorId: 'device-a', evaluatorName: 'Evaluator A', employeeId: 'E1', pl: 4, pot: 3 });
    row = (await request('/api/results'))[0];
    assert.equal(row.count, 1);
    assert.equal(row.gridCounts[4], 0);
    assert.equal(row.voteDetails[0].grid, 1);
    assert.equal((await request('/api/results?mode=initial'))[0].count, 0);
    await request('/api/vote?mode=initial', { evaluatorId:'initial-a', evaluatorName:'Initial Reviewer', employeeId:'E1', pl:3, pot:2 });
    const initial = (await request('/api/results?mode=initial'))[0];
    assert.equal(initial.voteDetails[0].evaluatorName, 'Initial Reviewer');
    assert.equal(initial.voteDetails[0].grid, 5);
    assert.equal((await request('/api/results'))[0].voteDetails[0].evaluatorName, 'Evaluator A');
    const stored = JSON.parse(fs.readFileSync(path.join(dir, 'data', 'session.json'), 'utf8'));
    assert.equal(stored.rooms.default.votes.E1['device-a'].evaluatorName, 'Evaluator A');
  } finally {
    if (child.exitCode === null) {
      const closed = new Promise(resolve => child.once('exit', resolve));
      child.kill();
      await closed;
    }
    if (path.dirname(path.resolve(dir)) !== path.resolve(parent)) throw new Error('Invalid test directory');
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

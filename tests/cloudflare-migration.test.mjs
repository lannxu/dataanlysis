import test from 'node:test';
import assert from 'node:assert/strict';
import { scryptSync } from 'node:crypto';

const base = process.env.CF_MIGRATION_TEST_URL;
test('Cloudflare migration preserves existing accounts and both assessment modes', {skip: !base}, async () => {
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
  const password = 'legacy-test-password', salt = '1234567890abcdef';
  const store = {
    users: {legacy: {id: 'legacy', username: 'legacy', name: 'Legacy', enabled: true, role: 'admin', passwordHash: salt + ':' + scryptSync(password, salt, 64).toString('hex')}},
    roomOrder: ['default'],
    rooms: {default: {name: 'Migrated', ownerId: 'legacy', currentIndex: 0, initialCurrentIndex: 0, employees: [{id: 'E1', employeeNo: 'E1', name: 'Employee', fields: {'EDSP 2024': 'A'}}], votes: {E1: {a: {pl: 5, pot: 3}}}, initialVotes: {E1: {a: {pl: 3, pot: 2}}}, decisions: {}, initialDecisions: {}, discussionNotes: {}, initialDiscussionNotes: {}}}
  };
  const endpoint = base + '/api/migration/import';
  const headers = {'content-type': 'application/json', Authorization: 'Bearer ' + process.env.CF_MIGRATION_TEST_TOKEN};
  assert.equal((await fetch(endpoint, {method: 'POST', body: JSON.stringify(store)})).status, 404);
  const imported = await fetch(endpoint, {method: 'POST', headers, body: JSON.stringify(store)});
  assert.equal(imported.status, 200, await imported.text());
  assert.equal((await fetch(endpoint, {method: 'POST', headers, body: JSON.stringify(store)})).status, 409);
  const login = await fetch(base + '/api/auth/login', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({username: 'legacy', password})});
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const live = await (await fetch(base + '/api/results', {headers: {cookie}})).json();
  const initial = await (await fetch(base + '/api/results?mode=initial', {headers: {cookie}})).json();
  assert.equal(live[0].gridCounts[0], 1);
  assert.equal(initial[0].gridCounts[4], 1);
  assert.equal(initial[0].fields['EDSP 2024'], 'A');
});

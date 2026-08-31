import test from 'node:test';
import assert from 'node:assert/strict';
import { createReviewService } from '../cloudflare/service.mjs';

test('Fetch adapter preserves auth, ownership, live/initial isolation and exports', async () => {
  const store = {rooms: {default: {employees: [], votes: {}, initialVotes: {}, decisions: {}, initialDecisions: {}, discussionNotes: {}, initialDiscussionNotes: {}, currentIndex: 0, initialCurrentIndex: 0}}, roomOrder: ['default'], users: {}};
  const sessions = new Map();
  let cookie = '';
  async function call(path, body, options = {}) {
    const request = new Request('https://review.example' + path, {method: options.method || (body ? 'POST' : 'GET'), headers: {'content-type': 'application/json', cookie: options.public ? '' : cookie}, body: body ? JSON.stringify(body) : undefined});
    const response = await createReviewService({store, sessions, request, events: [], assets: {fetch: async () => new Response('page')}, validPhoto: () => ''});
    if (response.headers.has('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    return response;
  }
  assert.equal((await call('/admin.html')).status, 302);
  assert.equal((await call('/api/auth/setup', {username: 'admin', password: 'test-password'})).status, 200);
  const room = await (await call('/api/rooms', {name: 'Panel'})).json();
  const suffix = '?room=' + room.id;
  assert.deepEqual(await (await call('/api/evaluator-visibility' + suffix)).json(), {showEvaluatorNames: true});
  assert.equal((await call('/api/evaluator-visibility' + suffix, {showEvaluatorNames: false}, {public: true})).status, 401);
  assert.equal((await call('/api/evaluator-visibility' + suffix, {showEvaluatorNames: 'false'})).status, 400);
  assert.equal((await call('/api/evaluator-visibility' + suffix, {showEvaluatorNames: false})).status, 200);
  assert.deepEqual(await (await call('/api/evaluator-visibility' + suffix)).json(), {showEvaluatorNames: false});
  assert.equal((await (await call('/api/evaluator-visibility')).json()).showEvaluatorNames, true);
  assert.equal((await call('/api/employees' + suffix, {employees: [{id: 'E1', name: 'One'}, {id: 'E2', name: 'Two'}]})).status, 200);
  const vote = {employeeId: 'E1', evaluatorId: 'judge-a', evaluatorName: 'Judge A', pl: 5, pot: 3};
  assert.equal((await call('/api/vote' + suffix, vote, {public: true})).status, 200);
  assert.equal((await call('/api/vote' + suffix + '&mode=initial', {...vote, pl: 3, pot: 2}, {public: true})).status, 200);
  const live = await (await call('/api/results' + suffix)).json();
  const initial = await (await call('/api/results' + suffix + '&mode=initial')).json();
  assert.equal(live[0].gridCounts[0], 1);
  assert.equal(initial[0].gridCounts[4], 1);
  assert.equal(live[0].voteDetails[0].evaluatorName, 'Judge A');
  await call('/api/decision' + suffix + '&mode=initial', {employeeId: 'E1', type: 'direct', grid: 2, pl: 4});
  const csv = await (await call('/api/export-initial-summary.csv' + suffix)).text();
  assert.match(csv.split('\r\n')[0], /"Final POT"$/);
  assert.match(csv, /"PL4","POT2"/);
  assert.equal((await call('/api/results' + suffix, null, {public: true})).status, 401);
  assert.equal((await call('/api/state?room=missing')).status, 404);
  await call('/api/rooms/' + room.id + '/lock', {locked: true});
  assert.equal((await call('/api/evaluator-visibility' + suffix, {showEvaluatorNames: true})).status, 423);
  assert.equal((await call('/api/vote' + suffix, vote, {public: true})).status, 423);
});

import { DurableObject } from 'cloudflare:workers';
import { Buffer } from 'node:buffer';
import { createReviewService } from './service.mjs';

const empty = () => ({store: {rooms: {default: {name: 'Default', employees: [], votes: {}, initialVotes: {}, decisions: {}, initialDecisions: {}, discussionNotes: {}, initialDiscussionNotes: {}, currentIndex: 0, initialCurrentIndex: 0}}, roomOrder: ['default'], users: {}}, sessions: []});
const json = (body, status = 200) => Response.json(body, {status, headers: {'Cache-Control': 'no-store'}});
const photoPattern = /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=]+)$/;
const roomId = url => url.searchParams.get('room') || 'default';
const validPhoto = (value, room) => {
  if (typeof value !== 'string') return '';
  if (photoPattern.test(value) && value.length <= 12000000) return value;
  const url = new URL(value || '/', 'https://photo.local');
  return value.startsWith('/api/photos/') && url.origin === 'https://photo.local' && roomId(url) === room && /^\/api\/photos\/[a-f0-9]{64}$/.test(url.pathname) ? value : '';
};

export class ReviewState extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.queue = Promise.resolve();
    ctx.blockConcurrencyWhile(async () => {
      const count = await ctx.storage.get('chunks');
      if (!count) this.snapshot = empty();
      else {
        const chunks = await ctx.storage.get(Array.from({length: count}, (_, i) => 'state:' + i));
        this.snapshot = JSON.parse(Array.from({length: count}, (_, i) => chunks.get('state:' + i)).join(''));
      }
    });
  }

  async persist(snapshot) {
    const text = JSON.stringify(snapshot), chunks = [];
    for (let i = 0; i < text.length; i += 16000) chunks.push(text.slice(i, i + 16000));
    await this.ctx.storage.transaction(async tx => {
      const previous = await tx.get('chunks') || 0;
      for (let i = 0; i < chunks.length; i++) await tx.put('state:' + i, chunks[i]);
      for (let i = chunks.length; i < previous; i++) await tx.delete('state:' + i);
      await tx.put('chunks', chunks.length);
    });
    this.snapshot = snapshot;
  }

  async storePhotos(store) {
    for (const [room, data] of Object.entries(store.rooms)) {
      for (const employee of data.employees || []) {
        const match = photoPattern.exec(employee.photo || '');
        if (!match) continue;
        const bytes = Buffer.from(match[2], 'base64');
        if (bytes.length > 9000000) throw new Error('Photo exceeds 9 MB');
        const hash = Buffer.from(await crypto.subtle.digest('SHA-256', bytes)).toString('hex');
        await this.env.PHOTOS.put('rooms/' + room + '/' + hash, bytes, {httpMetadata: {contentType: 'image/' + match[1]}});
        employee.photo = '/api/photos/' + hash + '?room=' + encodeURIComponent(room);
      }
    }
  }

  async fetch(request) {
    // Consume the incoming body in its own event before queued work begins.
    if (!['GET', 'HEAD'].includes(request.method)) {
      if (Number(request.headers.get('content-length')) > 30 * 1024 * 1024) return json({error: 'File exceeds 30 MB'}, 413);
      const body = await request.arrayBuffer();
      if (body.byteLength > 30 * 1024 * 1024) return json({error: 'File exceeds 30 MB'}, 413);
      request = new Request(request, {body});
    }
    const result = this.queue.then(() => this.handle(request));
    this.queue = result.catch(() => {});
    return result.catch(error => { console.error(error); return json({error: 'Unable to save or load data. Please retry.'}, 500); });
  }

  async handle(request) {
    const url = new URL(request.url), room = roomId(url);
    if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      const state = this.snapshot.store.rooms[room];
      if (!state) return json({error: 'Room not found'}, 404);
      const pair = new WebSocketPair(), [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server, [room]);
      server.serializeAttachment({room});
      server.send(JSON.stringify({type: 'state', room, data: {currentIndex: state.currentIndex || 0, total: state.employees.length, employee: state.employees[state.currentIndex || 0] || null}}));
      return new Response(null, {status: 101, webSocket: client});
    }
    if (url.pathname.startsWith('/api/photos/')) {
      const hash = url.pathname.slice('/api/photos/'.length);
      const state = this.snapshot.store.rooms[room];
      if (!/^[a-f0-9]{64}$/.test(hash) || !state?.employees.some(e => e.photo === url.pathname + url.search)) return json({error: 'Photo not found'}, 404);
      const photo = await this.env.PHOTOS.get('rooms/' + room + '/' + hash);
      if (!photo) return json({error: 'Photo not found'}, 404);
      const headers = new Headers({'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff'});
      photo.writeHttpMetadata(headers);
      return new Response(photo.body, {headers});
    }
    const mutation = !['GET', 'HEAD'].includes(request.method);
    if (mutation && request.headers.has('Origin') && request.headers.get('Origin') !== url.origin) return json({error: 'Origin not allowed'}, 403);
    if (url.pathname === '/api/migration/import') return await this.importSnapshot(request);
    const snapshot = structuredClone(this.snapshot);
    const runtime = {store: snapshot.store, sessions: new Map(snapshot.sessions.filter(([, s]) => s.expiresAt > Date.now())), request, assets: this.env.ASSETS, publicUrl: this.env.CLOUDFLARE_PUBLIC_URL, validPhoto, events: [], dirty: false};
    const response = await createReviewService(runtime);
    if (mutation && response.status < 400) {
      if (runtime.dirty) await this.storePhotos(snapshot.store);
      snapshot.sessions = [...runtime.sessions];
      await this.persist(snapshot);
      for (const event of runtime.events) {
        // Employee events may have contained inline photos before the R2 save.
        if (event.data?.employee) event.data.employee = snapshot.store.rooms[event.room]?.employees.find(e => e.id === event.data.employee.id) || null;
        for (const socket of this.ctx.getWebSockets(event.room)) {
          try { socket.send(JSON.stringify(event)); } catch { socket.close(1011, 'Reconnect'); }
        }
      }
    }
    return response;
  }

  async importSnapshot(request) {
    if (request.method !== 'POST' || this.env.ALLOW_MIGRATION !== 'true' || !this.env.MIGRATION_TOKEN || request.headers.get('Authorization') !== 'Bearer ' + this.env.MIGRATION_TOKEN) return json({error: 'Not found'}, 404);
    if (Object.keys(this.snapshot.store.users).length || Object.values(this.snapshot.store.rooms).some(r => r.employees?.length)) return json({error: 'Import only allowed into an empty deployment'}, 409);
    const text = await request.text();
    if (text.length > 30000000) return json({error: 'Backup too large'}, 413);
    let store;
    try {
      store = JSON.parse(text, (key, value) => {
        if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('Invalid key');
        return value;
      });
      if (!store.rooms || !store.users || typeof store.rooms !== 'object' || Array.isArray(store.rooms) || typeof store.users !== 'object') throw new Error();
      for (const [id, room] of Object.entries(store.rooms)) {
        if (!/^[a-z0-9_-]{1,40}$/.test(id) || !Array.isArray(room.employees) || (room.ownerId && !Object.hasOwn(store.users, room.ownerId))) throw new Error();
        for (const e of room.employees) e.photo = validPhoto(e.photo, id);
      }
    } catch { return json({error: 'Invalid session.json backup'}, 400); }
    await this.storePhotos(store);
    await this.persist({store, sessions: []});
    return json({ok: true, rooms: Object.keys(store.rooms).length, users: Object.keys(store.users).length});
  }

  webSocketMessage() {}
  webSocketClose(socket, code) { socket.close([1005, 1006, 1015].includes(code) ? 1000 : code, 'Connection closed'); }
  webSocketError(socket) { socket.close(1011, 'Reconnect'); }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let decoded;
    try { decoded = decodeURIComponent(url.pathname); } catch { return json({error: 'Invalid path'}, 400); }
    if (decoded !== url.pathname) {
      if (decoded.includes('\\') || decoded.includes('\0')) return json({error: 'Invalid path'}, 400);
      url.pathname = decoded;
      request = new Request(url, request);
    }
    if (url.pathname === '/' && !request.headers.has('Upgrade')) return Response.redirect(url.origin + '/home.html', 302);
    const protectedPage = /^\/(home|admin|summary|initial-results|accounts|change-password)(?:\.html)?\/?$/;
    if (protectedPage.test(url.pathname) && !url.pathname.endsWith('.html')) {
      url.pathname = url.pathname.replace(/\/$/, '').replace(/\.html$/, '') + '.html';
      return Response.redirect(url.toString(), 302);
    }
    if (url.pathname.startsWith('/api/') || url.pathname === '/healthz' || protectedPage.test(url.pathname) || request.headers.has('Upgrade')) {
      const result = await env.REVIEW_STATE.get(env.REVIEW_STATE.idFromName('talent-review-v3')).fetch(request);
      if (result.status === 101) return result;
      const response = new Response(result.body, result);
      if (!url.pathname.startsWith('/api/photos/')) response.headers.set('Cache-Control', 'no-store');
      response.headers.set('X-Content-Type-Options', 'nosniff');
      return response;
    }
    const asset = await env.ASSETS.fetch(request);
    const response = new Response(asset.body, asset);
    response.headers.set('Cache-Control', 'no-cache');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    return response;
  }
};

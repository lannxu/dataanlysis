import { Hono } from 'hono';
import { Buffer } from 'node:buffer';

// Preserve the existing route contracts while using the Workers Fetch API.
export class ReviewRouter {
  constructor() {
    this.router = new Hono();
    this.router.onError(error => {
      console.error(error);
      return Response.json({ error: 'Request failed. Please retry.' }, { status: 500 });
    });
  }

  wrap(handler, prefix = '') {
    return async (context, next) => {
      const q = context.get('request');
      const r = context.get('response');
      const originalPath = q.path;
      q.params = context.req.param();
      if (prefix) q.path = originalPath.slice(prefix.length) || '/';
      let downstream;
      await handler(q, r, () => {
        q.path = originalPath;
        downstream = next();
        return downstream;
      });
      if (downstream) await downstream;
      q.path = originalPath;
      return r.response || context.res;
    };
  }

  use(prefix, handler) {
    if (typeof prefix === 'function') this.router.use('*', this.wrap(prefix));
    else this.router.use(prefix + '/*', this.wrap(handler, prefix));
  }
  get(path, ...handlers) { this.router.get(path, ...handlers.map(fn => this.wrap(fn))); }
  post(path, ...handlers) { this.router.post(path, ...handlers.map(fn => this.wrap(fn))); }
  patch(path, ...handlers) { this.router.patch(path, ...handlers.map(fn => this.wrap(fn))); }
  delete(path, ...handlers) { this.router.delete(path, ...handlers.map(fn => this.wrap(fn))); }

  async fetch(request) {
    const url = new URL(request.url);
    let body = {};
    if (!['GET', 'HEAD'].includes(request.method)) {
      if (Number(request.headers.get('content-length')) > 30 * 1024 * 1024)
        return Response.json({ error: 'File exceeds 30 MB' }, { status: 413 });
      const bytes = await request.arrayBuffer();
      if (bytes.byteLength > 30 * 1024 * 1024)
        return Response.json({ error: 'File exceeds 30 MB' }, { status: 413 });
      try {
        body = request.headers.get('content-type')?.includes('application/json')
          ? (bytes.byteLength ? JSON.parse(new TextDecoder().decode(bytes), (key, value) => {
            if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('Invalid key');
            return value;
          }) : {})
          : Buffer.from(bytes);
      } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }
      if (body === null || typeof body !== 'object') return Response.json({error: 'Object body required'}, {status: 400});
      for (const key of ['evaluatorId', 'employeeId', 'room']) {
        if (['__proto__', 'prototype', 'constructor'].includes(String(body[key] || '')))
          return Response.json({error: 'Invalid identifier'}, {status: 400});
      }
    }
    const q = {
      method: request.method, path: url.pathname, originalUrl: url.pathname + url.search,
      query: Object.fromEntries(url.searchParams), body, params: {},
      protocol: url.protocol.slice(0, -1), secure: url.protocol === 'https:',
      headers: Object.fromEntries(request.headers),
      get: name => name.toLowerCase() === 'host' ? url.host : request.headers.get(name)
    };
    const r = {
      code: 200, headers: new Headers({ 'Cache-Control': 'no-store' }), response: null,
      status(code) { this.code = code; return this; },
      set(name, value) {
        if (typeof name === 'object') for (const [key, val] of Object.entries(name)) this.headers.set(key, val);
        else this.headers.set(name, value);
        return this;
      },
      setHeader(name, value) { return this.set(name, value); },
      type(value) { return this.set('Content-Type', value); },
      send(value) {
        if (!this.headers.has('Content-Type')) this.headers.set('Content-Type', 'text/html; charset=utf-8');
        this.response = new Response(value, { status: this.code, headers: this.headers });
        return this;
      },
      json(value) { this.set('Content-Type', 'application/json; charset=utf-8'); return this.send(JSON.stringify(value)); },
      redirect(value) { this.status(302).set('Location', value); return this.send(null); },
      forward(response) { this.response = response; return this; }
    };
    const env = { request: q, response: r };
    // Context variables are initialized before all registered legacy handlers.
    const gateway = new Hono();
    gateway.use('*', async (c, next) => { c.set('request', env.request); c.set('response', env.response); await next(); });
    gateway.route('/', this.router);
    return gateway.fetch(request);
  }
}

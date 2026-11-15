// lib/router.js — Minimal method+pattern router.
// Routes are registered as { method, pattern, handler }. A handler is
// async (req, res, params) => void. Patterns may contain :params.

/** @typedef {{ method: string, pattern: string, handler: (req: any, res: any, params: Record<string,string>) => Promise<void>|void }} Route */

export class Router {
  constructor() { /** @type {Route[]} */ this.routes = []; }

  add(method, pattern, handler) {
    this.routes.push({ method: method.toUpperCase(), pattern, handler });
    return this;
  }
  get(p, h) { return this.add('GET', p, h); }
  post(p, h) { return this.add('POST', p, h); }
  put(p, h) { return this.add('PUT', p, h); }
  del(p, h) { return this.add('DELETE', p, h); }
  options(p, h) { return this.add('OPTIONS', p, h); }

  /** Convert a pattern like /api/incidents/:id into a regex + param names.
   *  A trailing /* is a catch-all wildcard that matches the rest of the path. */
  static compile(pattern) {
    const params = [];
    let isWildcard = false;
    let body = pattern;
    // Catch-all: trailing /*
    if (body.endsWith('/*')) {
      isWildcard = true;
      body = body.slice(0, -2); // strip /*
    }
    const escaped = body.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/:([A-Za-z_]\w*)/g, (_, name) => {
        params.push(name);
        return '([A-Za-z0-9_-]+)';
      });
    const suffix = isWildcard ? '.*' : '';
    const re = new RegExp('^' + escaped + suffix + '$');
    return { re, params, isWildcard };
  }

  /** Find a matching route. Returns { route, params } or null. */
  match(method, pathname) {
    for (const route of this.routes) {
      if (route.method !== method.toUpperCase()) continue;
      const { re, params } = Router.compile(route.pattern);
      const m = re.exec(pathname);
      if (m) {
        const out = {};
        params.forEach((p, i) => { out[p] = m[i + 1]; });
        return { route, params: out };
      }
    }
    return null;
  }

  /** Dispatch a request. Handles OPTIONS, 404, 405, and 500.
   *  @param {object} req
   *  @param {object} res
   *  @param {string} pathname
   *  @param {object} [query]  parsed query string (key→string) */
  async dispatch(req, res, pathname, query = {}) {
    // Always allow CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Range, Authorization',
      });
      return res.end();
    }
    const m = this.match(req.method, pathname);
    if (!m) {
      // If path matches but method differs → 405
      const anyMethod = this.routes.some(r => Router.compile(r.pattern).re.test(pathname));
      if (anyMethod) return sendMethodNotAllowed(res);
      return sendNotFound(res, pathname);
    }
    try {
      await m.route.handler(req, res, m.params, query, pathname);
    } catch (err) {
      console.error('[router] handler error:', err);
      if (!res.headersSent) {
        sendJSON(res, 500, { error: 'internal server error', detail: String(err?.message || err).slice(0, 200) });
      }
    }
  }
}

import { sendJSON } from './http.js';
function sendNotFound(res, pathname) {
  sendJSON(res, 404, { error: 'not found', path: pathname });
}
function sendMethodNotAllowed(res) {
  sendJSON(res, 405, { error: 'method not allowed' });
}

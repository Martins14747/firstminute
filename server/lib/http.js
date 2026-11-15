// lib/http.js — HTTP helpers shared by all route modules.

import fs from 'node:fs';
import path from 'node:path';

/** Read the request body as a Buffer, with a size limit. Rejects if too large. */
export function readBody(req, limit = 15 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** Parse a JSON request body. Returns {ok, data, error}. */
export async function readJSON(req, limit) {
  try {
    const buf = await readBody(req, limit);
    if (!buf.length) return { ok: false, error: 'empty body' };
    return { ok: true, data: JSON.parse(buf.toString()) };
  } catch (e) {
    return { ok: false, error: e.message === 'body too large' ? 'body too large' : 'invalid JSON' };
  }
}

/** Send a JSON response with CORS headers. */
export function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Range, Authorization',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
  '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
};

/** Send a static file from disk with correct content type. */
export function sendFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) { sendJSON(res, 404, { error: 'not found' }); return; }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

/** Extract a numeric ID from a path like /api/incidents/:id — returns null if invalid. */
export function pathId(pathname, prefix) {
  if (!pathname.startsWith(prefix)) return null;
  const tail = pathname.slice(prefix.length);
  // Allow only safe characters in ids
  if (!/^[A-Za-z0-9_-]+$/.test(tail)) return null;
  return tail;
}

/** Haversine distance in km between two lat/lng points. */
export function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Sleep helper. */
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

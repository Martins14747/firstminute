// routes/static.js — Serves the frontend HTML, README, and other static assets
// from the download directory. Path traversal is blocked.

import path from 'node:path';
import fs from 'node:fs';
import { sendFile, sendJSON } from '../lib/http.js';
import { config } from '../config.js';

const DOWNLOAD_DIR = config.downloadDir;

// Map friendly URLs to actual files.
const ROOT_MAP = {
  '/': 'firstminute.html',
  '/firstminute': 'firstminute.html',
  '/firstminute.html': 'firstminute.html',
  '/index.html': 'firstminute.html',
};

export function staticRoute(req, res, params, query, pathname) {
  const mapped = ROOT_MAP[pathname];
  let filePath;
  if (mapped) {
    filePath = path.join(DOWNLOAD_DIR, mapped);
  } else {
    filePath = path.join(DOWNLOAD_DIR, path.normalize(pathname));
  }
  // Block path traversal: resolved path must stay inside DOWNLOAD_DIR.
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(DOWNLOAD_DIR)) {
    return sendJSON(res, 403, { error: 'forbidden' });
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    return sendJSON(res, 404, { error: 'not found', path: pathname });
  }
  sendFile(res, resolved);
}

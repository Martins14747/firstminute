// lib/logger.js — Lightweight structured logger.
// Writes to stdout/stderr and optionally to a file. Levels: debug/info/warn/error.

import fs from 'node:fs';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const ENV_LEVEL = (process.env.LOG_LEVEL || 'info').toLowerCase();
const MIN_LEVEL = LEVELS[ENV_LEVEL] ?? LEVELS.info;
const LOG_FILE = process.env.LOG_FILE || null;

let _fileStream = null;
if (LOG_FILE) {
  try { _fileStream = fs.createWriteStream(LOG_FILE, { flags: 'a' }); }
  catch { _fileStream = null; }
}

function fmt(obj) {
  try { return JSON.stringify(obj); } catch { return String(obj); }
}

function log(level, msg, meta) {
  if (LEVELS[level] < MIN_LEVEL) return;
  const line = fmt({
    t: new Date().toISOString(),
    level,
    msg,
    ...(meta || {}),
  });
  const stream = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
  stream.write(line + '\n');
  if (_fileStream) _fileStream.write(line + '\n');
}

export const logger = {
  debug: (m, meta) => log('debug', m, meta),
  info: (m, meta) => log('info', m, meta),
  warn: (m, meta) => log('warn', m, meta),
  error: (m, meta) => log('error', m, meta),
};

/** Express-like request logging middleware (used by the static + API layers). */
export function requestLog(method, pathname, status, ms) {
  log('info', 'request', { method, pathname, status, ms });
}

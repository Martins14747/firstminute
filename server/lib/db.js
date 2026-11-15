// lib/db.js — Tiny JSON-file persistence layer.
// Stores incidents and reminders in a single JSON file, atomically written.
// Designed for a single-process server (concurrent writes are serialized).

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { logger } from './logger.js';

const DB_DIR = config.dataDir;
const DB_FILE = path.join(DB_DIR, 'db.json');

// In-memory state, persisted to disk on every mutation.
let _state = { incidents: [], reminders: [] };
let _writeChain = Promise.resolve();
let _loaded = false;

function load() {
  if (_loaded) return;
  _loaded = true;
  try {
    fs.mkdirSync(DB_DIR, { recursive: true });
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      _state = {
        incidents: Array.isArray(parsed.incidents) ? parsed.incidents : [],
        reminders: Array.isArray(parsed.reminders) ? parsed.reminders : [],
      };
      logger.info('db loaded', { incidents: _state.incidents.length, reminders: _state.reminders.length });
    } else {
      logger.info('db initialised (new file)');
    }
  } catch (e) {
    logger.error('db load failed, starting empty', { error: String(e.message) });
    _state = { incidents: [], reminders: [] };
  }
}

function persist() {
  // Serialize writes so they never interleave.
  _writeChain = _writeChain.then(() => {
    try {
      const tmp = DB_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(_state, null, 2));
      fs.renameSync(tmp, DB_FILE); // atomic on same filesystem
    } catch (e) {
      logger.error('db persist failed', { error: String(e.message) });
    }
  });
  return _writeChain;
}

// ---------- Incidents ----------
export function listIncidents() {
  load();
  return _state.incidents.slice().sort((a, b) => b.createdAt - a.createdAt);
}

export function getIncident(id) {
  load();
  return _state.incidents.find((i) => i.id === id) || null;
}

export function createIncident(data) {
  load();
  const incident = {
    id: randomUUID(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    type: String(data.type || 'other').slice(0, 50),
    severity: ['low', 'med', 'high'].includes(data.severity) ? data.severity : 'med',
    location: String(data.location || '').slice(0, 200),
    lat: typeof data.lat === 'number' ? data.lat : null,
    lng: typeof data.lng === 'number' ? data.lng : null,
    victims: Math.max(1, parseInt(data.victims, 10) || 1),
    description: String(data.description || '').slice(0, 2000),
    reporterName: String(data.reporterName || '').slice(0, 100),
    reporterPhone: String(data.reporterPhone || '').slice(0, 30),
    status: 'reported',
  };
  _state.incidents.push(incident);
  if (_state.incidents.length > 1000) _state.incidents = _state.incidents.slice(-1000);
  persist();
  logger.info('incident created', { id: incident.id, type: incident.type });
  return incident;
}

export function updateIncident(id, patch) {
  load();
  const inc = _state.incidents.find((i) => i.id === id);
  if (!inc) return null;
  const allowed = ['severity', 'location', 'description', 'status', 'victims'];
  for (const k of allowed) {
    if (k in patch) inc[k] = patch[k];
  }
  if (patch.lat !== undefined) inc.lat = typeof patch.lat === 'number' ? patch.lat : null;
  if (patch.lng !== undefined) inc.lng = typeof patch.lng === 'number' ? patch.lng : null;
  inc.updatedAt = Date.now();
  persist();
  return inc;
}

export function deleteIncident(id) {
  load();
  const idx = _state.incidents.findIndex((i) => i.id === id);
  if (idx === -1) return false;
  _state.incidents.splice(idx, 1);
  persist();
  return true;
}

// ---------- Reminders ----------
export function listReminders() {
  load();
  return _state.reminders.slice().sort((a, b) => a.dueAt - b.dueAt);
}

export function createReminder(data) {
  load();
  const reminder = {
    id: randomUUID(),
    createdAt: Date.now(),
    title: String(data.title || 'Follow-up reminder').slice(0, 200),
    emergencyType: String(data.emergencyType || '').slice(0, 50),
    dueAt: typeof data.dueAt === 'number' ? data.dueAt : Date.now() + 24 * 3600 * 1000,
    delivered: false,
  };
  _state.reminders.push(reminder);
  if (_state.reminders.length > 500) _state.reminders = _state.reminders.slice(-500);
  persist();
  return reminder;
}

export function getReminder(id) {
  load();
  return _state.reminders.find((r) => r.id === id) || null;
}

export function deleteReminder(id) {
  load();
  const idx = _state.reminders.findIndex((r) => r.id === id);
  if (idx === -1) return false;
  _state.reminders.splice(idx, 1);
  persist();
  return true;
}

export function markReminderDelivered(id) {
  load();
  const r = _state.reminders.find((x) => x.id === id);
  if (!r) return null;
  r.delivered = true;
  persist();
  return r;
}

/** Reset state — for tests only. */
export function _reset() {
  _state = { incidents: [], reminders: [] };
  _loaded = true;
  try { fs.unlinkSync(DB_FILE); } catch {}
}

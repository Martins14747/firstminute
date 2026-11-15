// test/lib.test.js — Unit tests for lib layer (router, http, db, videoStore).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Router } from '../lib/router.js';
import { haversine, pathId } from '../lib/http.js';
import {
  createIncident, getIncident, listIncidents, updateIncident, deleteIncident,
  createReminder, getReminder, listReminders, deleteReminder, markReminderDelivered, _reset,
} from '../lib/db.js';
import {
  isReady, isGenerating, isKnownVideo, getStatus, listAll, readyCount, _resetJobs,
} from '../lib/videoStore.js';

// ---------- Router ----------
test('router: static path match', () => {
  const r = new Router();
  let called = false;
  r.get('/api/health', () => { called = true; });
  const m = r.match('GET', '/api/health');
  assert.ok(m);
  m.route.handler();
  assert.ok(called);
});

test('router: param path match', () => {
  const r = new Router();
  r.get('/api/emergencies/:id', () => {});
  const m = r.match('GET', '/api/emergencies/cpr');
  assert.ok(m);
  assert.equal(m.params.id, 'cpr');
});

test('router: catch-all wildcard /* matches any subpath', () => {
  const r = new Router();
  r.get('/*', () => {});
  assert.ok(r.match('GET', '/firstminute.html'));
  assert.ok(r.match('GET', '/css/style.css'));
  assert.ok(r.match('GET', '/'));
  assert.ok(r.match('GET', '/videos/cpr.mp4'));
});

test('router: wildcard does NOT shadow exact routes registered first', () => {
  const r = new Router();
  r.get('/api/health', () => 'health');
  r.get('/*', () => 'static');
  assert.equal(r.match('GET', '/api/health').route.handler(), 'health');
  assert.equal(r.match('GET', '/index.html').route.handler(), 'static');
});

test('router: method mismatch returns null (→ 405 in dispatch)', () => {
  const r = new Router();
  r.post('/api/doctor', () => {});
  assert.equal(r.match('GET', '/api/doctor'), null);
  assert.ok(r.match('POST', '/api/doctor'));
});

test('router: no match returns null', () => {
  const r = new Router();
  r.get('/api/health', () => {});
  assert.equal(r.match('GET', '/nope'), null);
});

test('router: compile rejects path traversal chars in :id', () => {
  const r = new Router();
  r.get('/api/incidents/:id', () => {});
  // Only [A-Za-z0-9_-] allowed, so ../etc is not a match
  assert.equal(r.match('GET', '/api/incidents/../etc/passwd'), null);
});

// ---------- http helpers ----------
test('http: haversine distance', () => {
  const d = haversine(9.0764, 7.4838, 9.0764, 7.4838); // same point
  assert.ok(d < 1);
  const lagosToAbuja = haversine(6.5146, 3.3739, 9.0764, 7.4838);
  assert.ok(lagosToAbuja > 500 && lagosToAbuja < 1000, `Lagos-Abuja ~800km, got ${lagosToAbuja}`);
});

test('http: pathId rejects unsafe chars', () => {
  assert.equal(pathId('/api/incidents/abc-123', '/api/incidents/'), 'abc-123');
  assert.equal(pathId('/api/incidents/../etc', '/api/incidents/'), null);
  assert.equal(pathId('/api/incidents/a b', '/api/incidents/'), null);
  assert.equal(pathId('/api/other/x', '/api/incidents/'), null);
});

// ---------- db (incidents) ----------
test('db: incident CRUD lifecycle', () => {
  _reset();
  const inc = createIncident({ type: 'bleeding', severity: 'high', description: 'test cut' });
  assert.ok(inc.id);
  assert.equal(inc.type, 'bleeding');
  assert.equal(inc.severity, 'high');
  assert.equal(inc.status, 'reported');

  const fetched = getIncident(inc.id);
  assert.deepEqual(fetched, inc);

  const updated = updateIncident(inc.id, { status: 'resolved', victims: 3 });
  assert.equal(updated.status, 'resolved');
  assert.equal(updated.victims, 3);

  const listed = listIncidents();
  assert.equal(listed.length, 1);

  assert.equal(deleteIncident(inc.id), true);
  assert.equal(getIncident(inc.id), null);
  assert.equal(deleteIncident(inc.id), false);
});

test('db: incident field validation', () => {
  _reset();
  const inc = createIncident({
    type: 'x'.repeat(100), severity: 'invalid', victims: -5, description: 'd'.repeat(5000),
  });
  assert.ok(inc.type.length <= 50, 'type truncated');
  assert.equal(inc.severity, 'med', 'invalid severity → med');
  assert.equal(inc.victims, 1, 'negative victims → 1');
  assert.ok(inc.description.length <= 2000, 'description truncated');
});

// ---------- db (reminders) ----------
test('db: reminder CRUD lifecycle', () => {
  _reset();
  const rem = createReminder({ title: 'Check patient', emergencyType: 'burns', dueAt: 1234567890 });
  assert.ok(rem.id);
  assert.equal(rem.delivered, false);

  const marked = markReminderDelivered(rem.id);
  assert.equal(marked.delivered, true);

  assert.equal(deleteReminder(rem.id), true);
  assert.equal(getReminder(rem.id), null);
  assert.equal(deleteReminder(rem.id), false);
});

// ---------- videoStore ----------
test('videoStore: known + unknown ids', () => {
  assert.ok(isKnownVideo('cpr'));
  assert.ok(isKnownVideo('snake'));
  assert.ok(!isKnownVideo('nonexistent'));
});

test('videoStore: cpr video is cached (ready)', () => {
  // The CPR walkthrough is pre-cached on disk
  assert.ok(isReady('cpr'), 'cpr.mp4 should be cached');
});

test('videoStore: getStatus for cached video returns ready', () => {
  const s = getStatus('cpr');
  assert.equal(s.status, 'ready');
  assert.ok(s.url.endsWith('/cpr.mp4'));
  assert.ok(s.caption);
});

test('videoStore: getStatus for unknown id', () => {
  const s = getStatus('nonexistent');
  assert.equal(s.status, 'unknown');
});

test('videoStore: listAll returns 12 entries', () => {
  const list = listAll();
  assert.equal(list.length, 12);
  assert.ok(readyCount() >= 1, 'at least cpr cached');
});

test('videoStore: not generating when no marker', () => {
  assert.equal(isGenerating('burns'), false);
});

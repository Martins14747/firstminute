// test/integration.test.js — Integration tests against a live HTTP server.
// Starts its own server instance on a test port so it does not depend on a
// separately-running one. Uses only fetch + assertions.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PORT = process.env.TEST_PORT || '9799';
const BASE = `http://localhost:${PORT}`;
const SERVER_PATH = fileURLToPath(new URL('../server.js', import.meta.url));

let serverProc;

before(async () => {
  serverProc = spawn(process.execPath, [SERVER_PATH], {
    env: { ...process.env, PORT, LOG_LEVEL: 'error' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  // Wait for server to be ready
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('server did not start');
});

after(() => { if (serverProc) serverProc.kill(); });

async function getJSON(path, opts = {}) {
  const r = await fetch(`${BASE}${path}`, opts);
  const status = r.status;
  let body;
  try { body = await r.json(); } catch { body = null; }
  return { status, body, headers: r.headers };
}

async function postJSON(path, data) {
  return getJSON(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

async function putJSON(path, data) {
  return getJSON(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

// ---------- Health ----------
test('GET /api/health returns ok', async () => {
  const { status, body } = await getJSON('/api/health');
  assert.equal(status, 200);
  assert.equal(body.status, 'ok');
  assert.equal(body.service, 'firstminute-backend');
});

test('GET /api/health/stats returns counts', async () => {
  const { status, body } = await getJSON('/api/health/stats');
  assert.equal(status, 200);
  assert.equal(body.counts.emergencies, 12);
  assert.equal(body.counts.hospitals, 30);
  assert.equal(body.counts.videosTotal, 12);
  assert.ok(body.uptimeSec >= 0);
});

// ---------- Emergencies ----------
test('GET /api/emergencies returns 12', async () => {
  const { status, body } = await getJSON('/api/emergencies');
  assert.equal(status, 200);
  assert.equal(body.count, 12);
  assert.equal(body.emergencies[0].id, 'cpr');
});

test('GET /api/emergencies?q=snake filters', async () => {
  const { body } = await getJSON('/api/emergencies?q=snake');
  assert.equal(body.count, 1);
  assert.equal(body.emergencies[0].id, 'snake');
});

test('GET /api/emergencies/cpr returns detail', async () => {
  const { status, body } = await getJSON('/api/emergencies/cpr');
  assert.equal(status, 200);
  assert.equal(body.id, 'cpr');
  assert.ok(body.steps.length >= 6);
});

test('GET /api/emergencies/nonexistent → 404', async () => {
  const { status } = await getJSON('/api/emergencies/nonexistent');
  assert.equal(status, 404);
});

// ---------- Hospitals ----------
test('GET /api/hospitals returns 30', async () => {
  const { body } = await getJSON('/api/hospitals');
  assert.equal(body.count, 30);
});

test('GET /api/hospitals?state=Lagos filters', async () => {
  const { body } = await getJSON('/api/hospitals?state=Lagos');
  assert.equal(body.count, 4);
  assert.ok(body.hospitals.every((h) => h.s === 'Lagos'));
});

test('GET /api/hospitals with lat/lng sorts by distance', async () => {
  const { body } = await getJSON('/api/hospitals?lat=9.076&lng=7.484&limit=3');
  assert.equal(body.count, 3);
  assert.ok(body.hospitals[0].distanceKm <= body.hospitals[1].distanceKm);
  assert.ok(body.hospitals[0].n.includes('Abuja'));
});

test('GET /api/hospitals/states returns list', async () => {
  const { body } = await getJSON('/api/hospitals/states');
  assert.ok(body.states.length >= 20);
  assert.ok(body.states.includes('Lagos'));
});

test('GET /api/hospitals/luth returns detail', async () => {
  const { status, body } = await getJSON('/api/hospitals/luth');
  assert.equal(status, 200);
  assert.equal(body.s, 'Lagos');
  assert.ok(body.p);
});

test('GET /api/hospitals/unknown → 404', async () => {
  const { status } = await getJSON('/api/hospitals/unknown');
  assert.equal(status, 404);
});

// ---------- Incidents CRUD ----------
let createdIncidentId;

test('POST /api/incidents creates', async () => {
  const { status, body } = await postJSON('/api/incidents', {
    type: 'bleeding', severity: 'high', description: 'integration test cut', victims: 1,
  });
  assert.equal(status, 201);
  assert.ok(body.incident.id);
  assert.equal(body.incident.type, 'bleeding');
  createdIncidentId = body.incident.id;
});

test('GET /api/incidents lists', async () => {
  const { body } = await getJSON('/api/incidents');
  assert.ok(body.count >= 1);
});

test('GET /api/incidents/:id returns detail', async () => {
  const { status, body } = await getJSON(`/api/incidents/${createdIncidentId}`);
  assert.equal(status, 200);
  assert.equal(body.incident.id, createdIncidentId);
});

test('PUT /api/incidents/:id updates', async () => {
  const { status, body } = await putJSON(`/api/incidents/${createdIncidentId}`, {
    status: 'resolved', victims: 2,
  });
  assert.equal(status, 200);
  assert.equal(body.incident.status, 'resolved');
  assert.equal(body.incident.victims, 2);
});

test('GET /api/incidents/unknown → 404', async () => {
  const { status } = await getJSON('/api/incidents/unknown-id');
  assert.equal(status, 404);
});

test('POST /api/incidents with empty object creates a default incident', async () => {
  // The schema defaults all fields, so {} is accepted (type→'other', severity→'med').
  const { status, body } = await postJSON('/api/incidents', {});
  assert.equal(status, 201);
  assert.equal(body.incident.type, 'other');
  assert.equal(body.incident.severity, 'med');
  assert.equal(body.incident.victims, 1);
});

test('POST /api/incidents with invalid JSON → 400', async () => {
  const r = await fetch(`${BASE}/api/incidents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'not valid json{',
  });
  assert.equal(r.status, 400);
});

test('DELETE /api/incidents/:id removes', async () => {
  const { status, body } = await getJSON(`/api/incidents/${createdIncidentId}`, { method: 'DELETE' });
  assert.equal(status, 200);
  assert.equal(body.deleted, true);
});

// ---------- Reminders CRUD ----------
let createdReminderId;

test('POST /api/reminders creates', async () => {
  const { status, body } = await postJSON('/api/reminders', {
    title: 'Check in 24h', emergencyType: 'burns', dueAt: Date.now() + 86400000,
  });
  assert.equal(status, 201);
  createdReminderId = body.reminder.id;
});

test('POST /api/reminders/:id/delivered marks delivered', async () => {
  const { status, body } = await postJSON(`/api/reminders/${createdReminderId}/delivered`, {});
  assert.equal(status, 200);
  assert.equal(body.reminder.delivered, true);
});

test('DELETE /api/reminders/:id removes', async () => {
  const { status } = await getJSON(`/api/reminders/${createdReminderId}`, { method: 'DELETE' });
  assert.equal(status, 200);
});

// ---------- Video ----------
test('GET /api/videos returns list with cpr ready', async () => {
  const { body } = await getJSON('/api/videos');
  assert.equal(body.total, 12);
  assert.ok(body.readyCount >= 1);
  const cpr = body.videos.find((v) => v.id === 'cpr');
  assert.ok(cpr.ready);
});

test('GET /api/video/cpr returns ready status', async () => {
  const { status, body } = await getJSON('/api/video/cpr');
  assert.equal(status, 200);
  assert.equal(body.status, 'ready');
  assert.ok(body.url.endsWith('/cpr.mp4'));
});

test('GET /api/video/burns returns absent or processing (not ready)', async () => {
  const { body } = await getJSON('/api/video/burns');
  assert.ok(['absent', 'processing'].includes(body.status), `got ${body.status}`);
});

test('GET /api/video/unknown → 404', async () => {
  const { status } = await getJSON('/api/video/unknown');
  assert.equal(status, 404);
});

test('GET /videos/cpr.mp4 streams with correct content type', async () => {
  const r = await fetch(`${BASE}/videos/cpr.mp4`);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'video/mp4');
  const buf = Buffer.from(await r.arrayBuffer());
  assert.ok(buf.length > 20000, 'non-trivial size');
});

test('GET /videos/unknown.mp4 → 404', async () => {
  const r = await fetch(`${BASE}/videos/unknown.mp4`);
  assert.equal(r.status, 404);
});

// ---------- Doctor + Analyze validation ----------
test('POST /api/doctor with no message → 400', async () => {
  const { status, body } = await postJSON('/api/doctor', {});
  assert.equal(status, 400);
  assert.equal(body.error, 'message required');
});

test('POST /api/doctor with invalid JSON → 400', async () => {
  const r = await fetch(`${BASE}/api/doctor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'not json{',
  });
  assert.equal(r.status, 400);
});

test('POST /api/analyze with no image → 400', async () => {
  const { status, body } = await postJSON('/api/analyze', {});
  assert.equal(status, 400);
  assert.equal(body.error, 'image (data URL) required');
});

test('POST /api/analyze with bad image URL → 400', async () => {
  const { status } = await postJSON('/api/analyze', { image: 'https://example.com/x.jpg' });
  assert.equal(status, 400);
});

// ---------- Static + CORS ----------
test('GET / serves firstminute.html', async () => {
  const r = await fetch(`${BASE}/`);
  assert.equal(r.status, 200);
  const text = await r.text();
  assert.ok(text.includes('<!DOCTYPE html>') || text.includes('<html'));
});

test('GET /firstminute.html serves HTML', async () => {
  const r = await fetch(`${BASE}/firstminute.html`);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'text/html; charset=utf-8');
});

test('GET /README.md serves markdown', async () => {
  const r = await fetch(`${BASE}/README.md`);
  assert.equal(r.status, 200);
  assert.ok(r.headers.get('content-type').includes('markdown'));
});

test('Path traversal blocked → 404', async () => {
  const r = await fetch(`${BASE}/../../../etc/passwd`);
  assert.ok(r.status === 404 || r.status === 403);
});

test('OPTIONS preflight returns 204 with CORS headers', async () => {
  const r = await fetch(`${BASE}/api/doctor`, { method: 'OPTIONS' });
  assert.equal(r.status, 204);
  assert.equal(r.headers.get('access-control-allow-origin'), '*');
  assert.ok(r.headers.get('access-control-allow-methods').includes('POST'));
});

test('API responses include CORS allow-origin header', async () => {
  const r = await fetch(`${BASE}/api/health`);
  assert.equal(r.headers.get('access-control-allow-origin'), '*');
});

// ---------- 405 method not allowed ----------
test('POST to GET-only /api/health → 405', async () => {
  const r = await fetch(`${BASE}/api/health`, { method: 'POST' });
  assert.equal(r.status, 405);
});

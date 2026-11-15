// routes/health.js — Health check + service stats.
//   GET /api/health               liveness probe
//   GET /api/health/stats         richer: counts, uptime, video cache

import { EMERGENCIES } from '../data/emergencies.js';
import { HOSPITALS } from '../data/hospitals.js';
import { readyCount, allVideoIds } from '../lib/videoStore.js';
import { listIncidents, listReminders } from '../lib/db.js';
import { sendJSON } from '../lib/http.js';

const startedAt = Date.now();

export function healthRoute(req, res) {
  sendJSON(res, 200, {
    status: 'ok',
    service: 'firstminute-backend',
    time: new Date().toISOString(),
  });
}

export function statsRoute(req, res) {
  sendJSON(res, 200, {
    status: 'ok',
    uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    counts: {
      emergencies: EMERGENCIES.length,
      hospitals: HOSPITALS.length,
      videosCached: readyCount(),
      videosTotal: allVideoIds().length,
      incidents: listIncidents().length,
      reminders: listReminders().length,
    },
    version: '1.0.0',
  });
}

// server.js — FirstMinute backend entry point.
// Wires the Router with all API routes and the static frontend.
//
// Run:  node server/server.js
// Then: http://localhost:8787/firstminute.html
//
// Env:  PORT (8787)  HOST (0.0.0.0)  LOG_LEVEL (info)  LOG_FILE (optional)

import http from 'node:http';
import { parse as parseQueryString } from 'node:querystring';
import { config } from './config.js';
import { Router } from './lib/router.js';
import { logger, requestLog } from './lib/logger.js';
import { readyCount, allVideoIds } from './lib/videoStore.js';

// Route handlers
import { doctorRoute } from './routes/doctor.js';
import { analyzeRoute } from './routes/analyze.js';
import {
  videoListRoute, videoStatusRoute, videoStartRoute, videoStreamRoute,
} from './routes/video.js';
import { emergenciesListRoute, emergencyDetailRoute } from './routes/emergencies.js';
import {
  hospitalsListRoute, hospitalStatesRoute, hospitalDetailRoute,
} from './routes/hospitals.js';
import {
  incidentsListRoute, incidentsCreateRoute,
  incidentDetailRoute, incidentUpdateRoute, incidentDeleteRoute,
} from './routes/incidents.js';
import {
  remindersListRoute, remindersCreateRoute,
  reminderDetailRoute, reminderDeleteRoute, reminderDeliveredRoute,
} from './routes/reminders.js';
import { healthRoute, statsRoute } from './routes/health.js';
import { staticRoute } from './routes/static.js';

const router = new Router();

// ---- Health & stats ----
router.get('/api/health', healthRoute);
router.get('/api/health/stats', statsRoute);

// ---- Doctor (LLM) & Analyze (VLM) ----
router.post('/api/doctor', doctorRoute);
router.post('/api/analyze', analyzeRoute);

// ---- Video walkthroughs ----
router.get('/api/videos', videoListRoute);
router.get('/api/video-status/:id', videoStatusRoute);
router.get('/api/video/:id', videoStatusRoute);
router.post('/api/video/:id', videoStartRoute);
router.get('/videos/:id.mp4', videoStreamRoute);

// ---- Emergencies ----
router.get('/api/emergencies', emergenciesListRoute);
router.get('/api/emergencies/:id', emergencyDetailRoute);

// ---- Hospitals ----
router.get('/api/hospitals', hospitalsListRoute);
router.get('/api/hospitals/states', hospitalStatesRoute);
router.get('/api/hospitals/:id', hospitalDetailRoute);

// ---- Incidents ----
router.get('/api/incidents', incidentsListRoute);
router.post('/api/incidents', incidentsCreateRoute);
router.get('/api/incidents/:id', incidentDetailRoute);
router.put('/api/incidents/:id', incidentUpdateRoute);
router.del('/api/incidents/:id', incidentDeleteRoute);

// ---- Reminders ----
router.get('/api/reminders', remindersListRoute);
router.post('/api/reminders', remindersCreateRoute);
router.get('/api/reminders/:id', reminderDetailRoute);
router.del('/api/reminders/:id', reminderDeleteRoute);
router.post('/api/reminders/:id/delivered', reminderDeliveredRoute);

// ---- Static frontend (catch-all GET) ----
// Mounted last so it never shadows an API route. The '/*' pattern is a
// catch-all wildcard that matches any GET path no API route claimed.
router.get('/*', (req, res, params, query, pathname) => staticRoute(req, res, params, query, pathname));

// ---- HTTP server ----
const server = http.createServer(async (req, res) => {
  const t0 = Date.now();
  const parsed = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(parsed.pathname);
  const query = parseQueryString(parsed.search.slice(1));

  try {
    await router.dispatch(req, res, pathname, query);
  } catch (err) {
    logger.error('unhandled request error', { error: String(err.message || err), pathname });
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'internal server error' }));
    }
  } finally {
    requestLog(req.method, pathname, res.statusCode, Date.now() - t0);
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    logger.error('port in use', { port: config.port });
    process.exit(1);
  }
  logger.error('server error', { error: String(err.message || err) });
});

server.listen(config.port, config.host, () => {
  const base = `http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.port}`;
  logger.info('FirstMinute backend running', { base, pid: process.pid });
  console.log('');
  console.log('FirstMinute backend running:');
  console.log('  App:        ' + base + '/firstminute.html');
  console.log('  Health:     GET  ' + base + '/api/health');
  console.log('  Doctor:     POST ' + base + '/api/doctor');
  console.log('  Analyze:    POST ' + base + '/api/analyze');
  console.log('  Emergencies:GET  ' + base + '/api/emergencies');
  console.log('  Hospitals:  GET  ' + base + '/api/hospitals');
  console.log('  Incidents:  CRUD ' + base + '/api/incidents');
  console.log('  Reminders:  CRUD ' + base + '/api/reminders');
  console.log('  Videos:     ' + readyCount() + '/' + allVideoIds().length + ' cached');
  console.log('');
});

export { server, router };

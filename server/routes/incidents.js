// routes/incidents.js — Incident report CRUD.
//   GET    /api/incidents          list all (newest first)
//   POST   /api/incidents          create
//   GET    /api/incidents/:id      get one
//   PUT    /api/incidents/:id      update fields
//   DELETE /api/incidents/:id      delete

import { readJSON, sendJSON } from '../lib/http.js';
import {
  listIncidents, getIncident, createIncident, updateIncident, deleteIncident,
} from '../lib/db.js';
import { logger } from '../lib/logger.js';

export function incidentsListRoute(req, res) {
  const list = listIncidents();
  sendJSON(res, 200, { count: list.length, incidents: list });
}

export async function incidentsCreateRoute(req, res) {
  const { ok, data, error } = await readJSON(req);
  if (!ok) return sendJSON(res, 400, { error });
  const incident = createIncident(data || {});
  logger.info('incident created', { id: incident.id });
  sendJSON(res, 201, { incident });
}

export function incidentDetailRoute(req, res, params) {
  const incident = getIncident(params.id);
  if (!incident) return sendJSON(res, 404, { error: 'incident not found' });
  sendJSON(res, 200, { incident });
}

export async function incidentUpdateRoute(req, res, params) {
  const { ok, data, error } = await readJSON(req);
  if (!ok) return sendJSON(res, 400, { error });
  const incident = updateIncident(params.id, data || {});
  if (!incident) return sendJSON(res, 404, { error: 'incident not found' });
  sendJSON(res, 200, { incident });
}

export function incidentDeleteRoute(req, res, params) {
  const removed = deleteIncident(params.id);
  if (!removed) return sendJSON(res, 404, { error: 'incident not found' });
  sendJSON(res, 200, { deleted: true, id: params.id });
}

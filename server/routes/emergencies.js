// routes/emergencies.js — Emergency protocol catalogue.
//   GET /api/emergencies          list all (optionally ?q=search)
//   GET /api/emergencies/:id      one emergency by id

import { sendJSON } from '../lib/http.js';
import { EMERGENCIES, getEmergency, searchEmergencies } from '../data/emergencies.js';

export function emergenciesListRoute(req, res, params, query) {
  const q = query && query.q;
  const list = q ? searchEmergencies(q) : EMERGENCIES;
  sendJSON(res, 200, { count: list.length, emergencies: list });
}

export function emergencyDetailRoute(req, res, params) {
  const em = getEmergency(params.id);
  if (!em) return sendJSON(res, 404, { error: 'unknown emergency' });
  sendJSON(res, 200, em);
}

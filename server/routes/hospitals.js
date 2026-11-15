// routes/hospitals.js — Hospital finder.
//   GET /api/hospitals            list, optional ?state=&lat=&lng=&limit=
//   GET /api/hospitals/:id         one hospital
//   GET /api/hospitals/states      distinct states that have a hospital

import { sendJSON } from '../lib/http.js';
import { listHospitals, getHospital, listStates } from '../data/hospitals.js';

export function hospitalsListRoute(req, res, params, query) {
  const opts = {};
  if (query.state) opts.state = query.state;
  if (query.lat !== undefined) opts.lat = parseFloat(query.lat);
  if (query.lng !== undefined) opts.lng = parseFloat(query.lng);
  if (query.limit) opts.limit = Math.min(100, parseInt(query.limit, 10) || 30);
  const list = listHospitals(opts);
  sendJSON(res, 200, { count: list.length, hospitals: list });
}

export function hospitalStatesRoute(req, res) {
  sendJSON(res, 200, { states: listStates() });
}

export function hospitalDetailRoute(req, res, params) {
  const h = getHospital(params.id);
  if (!h) return sendJSON(res, 404, { error: 'unknown hospital' });
  sendJSON(res, 200, h);
}

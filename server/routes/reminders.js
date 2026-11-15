// routes/reminders.js — Follow-up reminder CRUD.
//   GET    /api/reminders          list all (by due time)
//   POST   /api/reminders          create
//   GET    /api/reminders/:id      get one
//   DELETE /api/reminders/:id      delete
//   POST   /api/reminders/:id/delivered   mark delivered

import { readJSON, sendJSON } from '../lib/http.js';
import {
  listReminders, getReminder, createReminder, deleteReminder, markReminderDelivered,
} from '../lib/db.js';
import { logger } from '../lib/logger.js';

export function remindersListRoute(req, res) {
  const list = listReminders();
  sendJSON(res, 200, { count: list.length, reminders: list });
}

export async function remindersCreateRoute(req, res) {
  const { ok, data, error } = await readJSON(req);
  if (!ok) return sendJSON(res, 400, { error });
  const reminder = createReminder(data || {});
  logger.info('reminder created', { id: reminder.id, dueAt: reminder.dueAt });
  sendJSON(res, 201, { reminder });
}

export function reminderDetailRoute(req, res, params) {
  const reminder = getReminder(params.id);
  if (!reminder) return sendJSON(res, 404, { error: 'reminder not found' });
  sendJSON(res, 200, { reminder });
}

export function reminderDeleteRoute(req, res, params) {
  const removed = deleteReminder(params.id);
  if (!removed) return sendJSON(res, 404, { error: 'reminder not found' });
  sendJSON(res, 200, { deleted: true, id: params.id });
}

export function reminderDeliveredRoute(req, res, params) {
  const reminder = markReminderDelivered(params.id);
  if (!reminder) return sendJSON(res, 404, { error: 'reminder not found' });
  sendJSON(res, 200, { reminder });
}

// routes/doctor.js — POST /api/doctor
// Conversational first-aid guidance via the LLM.

import { readJSON, sendJSON } from '../lib/http.js';
import { chatComplete } from '../lib/zai.js';
import { DOCTOR_SYSTEM } from '../data/prompts.js';
import { getEmergency } from '../data/emergencies.js';
import { logger } from '../lib/logger.js';

export async function doctorRoute(req, res) {
  const { ok, data, error } = await readJSON(req);
  if (!ok) return sendJSON(res, 400, { error });

  const history = Array.isArray(data.history) ? data.history : [];
  const message = String(data.message || '').trim();
  const context = String(data.context || '').trim();

  if (!message && history.length === 0) {
    return sendJSON(res, 400, { error: 'message required' });
  }

  const messages = [{ role: 'assistant', content: DOCTOR_SYSTEM }];

  // Context may be an emergency id (rich) or free text.
  if (context) {
    const em = getEmergency(context);
    const contextText = em
      ? `Context the user is in: ${em.name}. ${em.what} Danger signs: ${em.danger}`
      : `Context the user is in: ${context}.`;
    messages.push({ role: 'assistant', content: contextText });
  }

  for (const m of history.slice(-10)) {
    if (m && m.role && m.content) {
      messages.push({ role: m.role, content: String(m.content).slice(0, 4000) });
    }
  }
  if (message) messages.push({ role: 'user', content: message });

  try {
    const reply = await chatComplete(messages);
    if (!reply.trim()) return sendJSON(res, 502, { error: 'empty response from model' });
    logger.info('doctor reply', { turns: history.length, chars: reply.length });
    sendJSON(res, 200, { reply });
  } catch (err) {
    logger.error('doctor error', { error: String(err.message || err).slice(0, 200) });
    sendJSON(res, 500, { error: 'AI request failed', detail: String(err.message || err).slice(0, 200) });
  }
}

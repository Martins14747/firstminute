// routes/analyze.js — POST /api/analyze
// Camera-vision wound/injury analysis via the VLM.

import { readJSON, sendJSON } from '../lib/http.js';
import { visionComplete } from '../lib/zai.js';
import { VISION_BASE, DEFAULT_VISION_QUESTION } from '../data/prompts.js';
import { logger } from '../lib/logger.js';

export function isVisionConfigurationError(error) {
  const message = String(error?.message || error);
  return /Configuration file not found or invalid|ZAI_BASE_URL and ZAI_API_KEY must both be set/i.test(message);
}

export async function analyzeRoute(req, res) {
  const { ok, data, error } = await readJSON(req);
  if (!ok) return sendJSON(res, 400, { error });

  const image = String(data.image || '');
  const question = String(data.question || '').trim() || DEFAULT_VISION_QUESTION;

  if (!image || !image.startsWith('data:image/')) {
    return sendJSON(res, 400, { error: 'image (data URL) required' });
  }

  const visionPrompt = `${VISION_BASE}\n\n${question}`;
  try {
    const description = await visionComplete(visionPrompt, image);
    logger.info('vision analysis', { chars: description.length });
    sendJSON(res, 200, { description });
  } catch (err) {
    const message = String(err.message || err);
    if (isVisionConfigurationError(err)) {
      logger.warn('vision analysis unavailable: provider configuration missing');
      return sendJSON(res, 503, { error: 'AI vision is not configured on this server' });
    }
    logger.error('analyze error', { error: message.slice(0, 200) });
    sendJSON(res, 500, { error: 'vision request failed', detail: String(err.message || err).slice(0, 200) });
  }
}

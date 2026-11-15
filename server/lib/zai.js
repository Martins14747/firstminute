// lib/zai.js — Singleton wrapper for the z-ai-web-dev-sdk
// Lazily creates one ZAI instance and reuses it across all route modules.
// Exposes safe accessor methods so route modules never touch the SDK directly.

import ZAI from 'z-ai-web-dev-sdk';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let _zaiPromise = null;

function writeConfigFromEnvironment() {
  const baseUrl = process.env.ZAI_BASE_URL?.trim();
  const apiKey = process.env.ZAI_API_KEY?.trim();
  if (!baseUrl && !apiKey) return;
  if (!baseUrl || !apiKey) {
    throw new Error('ZAI_BASE_URL and ZAI_API_KEY must both be set');
  }

  const projectConfig = path.resolve(process.cwd(), '.z-ai-config');
  const homeConfig = path.join(os.homedir(), '.z-ai-config');
  if (fs.existsSync(projectConfig) || fs.existsSync(homeConfig)) return;

  try {
    fs.writeFileSync(homeConfig, JSON.stringify({ baseUrl, apiKey }), {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
}

async function createZAI() {
  writeConfigFromEnvironment();
  return ZAI.create();
}

export function getZAI() {
  if (!_zaiPromise) _zaiPromise = createZAI();
  return _zaiPromise;
}

// Reset for testing.
export function _resetZAI() { _zaiPromise = null; }

/**
 * Run a chat completion. Returns the assistant text or '' if none.
 * @param {Array<{role:string, content:string}>} messages
 * @returns {Promise<string>}
 */
export async function chatComplete(messages) {
  const zai = await getZAI();
  const completion = await zai.chat.completions.create({
    messages,
    thinking: { type: 'disabled' },
  });
  return completion.choices?.[0]?.message?.content || '';
}

/**
 * Run a vision (image) completion. `imageDataUrl` must be a data:image/... URL.
 * @param {string} textPrompt
 * @param {string} imageDataUrl
 * @returns {Promise<string>}
 */
export async function visionComplete(textPrompt, imageDataUrl) {
  const zai = await getZAI();
  const response = await zai.chat.completions.createVision({
    model: 'glm-4.6v',
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: textPrompt },
        { type: 'image_url', image_url: { url: imageDataUrl } },
      ],
    }],
    thinking: { type: 'disabled' },
  });
  return response.choices?.[0]?.message?.content || '';
}

/**
 * Create a video generation task. Returns the raw create result (with .id).
 */
export async function videoCreate(prompt, opts = {}) {
  const zai = await getZAI();
  return zai.video.generations.create({
    prompt,
    quality: opts.quality || 'speed',
    duration: opts.duration || 5,
    size: opts.size || '1280x720',
    with_audio: opts.with_audio ?? false,
  });
}

/**
 * Query the status/result of an async task (video generation).
 */
export async function asyncQuery(taskId) {
  const zai = await getZAI();
  return zai.async.result.query(taskId);
}

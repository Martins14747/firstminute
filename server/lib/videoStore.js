// lib/videoStore.js — Video cache, marker files, and generation jobs.
// Owns all on-disk video state. Route modules call these functions only.

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import http from 'node:http';
import { config } from '../config.js';
import { videoCreate, asyncQuery } from './zai.js';
import { logger } from './logger.js';
import { getVideoPrompt, getVideoCaption, VIDEO_IDS } from '../data/video-prompts.js';

const VIDEOS_DIR = config.videosDir;
const VIDEO_OPTS = config.video;

// In-memory job state: { [id]: { status, taskId, startedAt, error } }
const jobs = {};

function videoPath(id) { return path.join(VIDEOS_DIR, id + '.mp4'); }
function markerPath(id) { return path.join(VIDEOS_DIR, '.' + id + '.generating'); }

export function isKnownVideo(id) { return !!getVideoPrompt(id); }
export function captionFor(id) { return getVideoCaption(id); }
export function allVideoIds() { return VIDEO_IDS; }

export function isReady(id) {
  try {
    const p = videoPath(id);
    return fs.existsSync(p) && fs.statSync(p).size > 20000;
  } catch { return false; }
}

export function isGenerating(id) {
  try {
    const mp = markerPath(id);
    if (!fs.existsSync(mp)) return false;
    const ageMin = (Date.now() - fs.statSync(mp).mtimeMs) / 60000;
    if (ageMin > VIDEO_OPTS.markerStaleMin) {
      try { fs.unlinkSync(mp); } catch {}
      return false;
    }
    return true;
  } catch { return false; }
}

export function writeMarker(id) { try { fs.writeFileSync(markerPath(id), String(Date.now())); } catch {} }
export function clearMarker(id) { try { fs.unlinkSync(markerPath(id)); } catch {} }

function downloadVideo(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close(); fs.unlink(dest, () => {});
        return downloadVideo(res.headers.location, dest).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        file.close(); fs.unlink(dest, () => {});
        return reject(new Error('download HTTP ' + res.statusCode));
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (e) => { file.close(); fs.unlink(dest, () => {}); reject(e); });
  });
}

/**
 * Kick off generation for an emergency id (idempotent).
 * Returns { status: 'ready' | 'processing' | 'failed' | 'absent' | error }.
 */
export async function startGeneration(id) {
  if (!isKnownVideo(id)) return { error: 'unknown emergency id' };
  if (isReady(id)) { clearMarker(id); return { status: 'ready', url: '/videos/' + id + '.mp4' }; }
  if (isGenerating(id)) return { status: 'processing' };
  if (jobs[id] && jobs[id].status === 'processing') return { status: 'processing' };

  jobs[id] = { status: 'processing', taskId: null, startedAt: Date.now(), error: null };
  writeMarker(id);
  const prompt = getVideoPrompt(id);

  // Run generation in the background; do not await here.
  (async () => {
    try {
      let create;
      for (let attempt = 1; attempt <= VIDEO_OPTS.retryAttempts; attempt++) {
        try {
          create = await videoCreate(prompt, VIDEO_OPTS);
          break;
        } catch (err) {
          const msg = String(err.message || err);
          if (msg.includes('429') && attempt < VIDEO_OPTS.retryAttempts) {
            logger.warn('video rate-limited, retrying', { id, attempt, wait: VIDEO_OPTS.retryBackoffMs * attempt });
            await new Promise((r) => setTimeout(r, VIDEO_OPTS.retryBackoffMs * attempt));
            continue;
          }
          throw err;
        }
      }
      if (!create || !create.id) throw new Error('no task id returned');
      jobs[id].taskId = create.id;
      logger.info('video task created', { id, taskId: create.id });

      let result = create;
      for (let i = 0; i < VIDEO_OPTS.pollMaxAttempts; i++) {
        await new Promise((r) => setTimeout(r, VIDEO_OPTS.pollIntervalMs));
        try { result = await asyncQuery(create.id); }
        catch (err) {
          if (String(err.message).includes('429')) continue;
          throw err;
        }
        if (result.task_status === 'SUCCESS') break;
        if (result.task_status === 'FAIL') throw new Error('generation failed');
      }
      const videoUrl = (result.video_result && result.video_result[0] && result.video_result[0].url)
        || result.video_url || result.url;
      if (!videoUrl) throw new Error('no video url in result');

      await downloadVideo(videoUrl, videoPath(id));
      if (!isReady(id)) throw new Error('downloaded file too small');
      jobs[id].status = 'ready';
      clearMarker(id);
      logger.info('video ready', { id });
    } catch (err) {
      jobs[id].status = 'failed';
      jobs[id].error = String(err.message || err).slice(0, 200);
      clearMarker(id);
      logger.error('video failed', { id, error: jobs[id].error });
    }
  })();

  return { status: 'processing' };
}

/**
 * Get the current status of a video.
 * @returns {{ status: string, url?: string, caption?: string, error?: string, elapsedSec?: number }}
 */
export function getStatus(id) {
  if (!isKnownVideo(id)) return { status: 'unknown', error: 'unknown emergency id' };
  const caption = captionFor(id);
  if (isReady(id)) {
    clearMarker(id);
    return { status: 'ready', url: '/videos/' + id + '.mp4', caption };
  }
  if (isGenerating(id)) return { status: 'processing', caption, note: 'generating' };
  const job = jobs[id];
  if (job && job.status === 'processing') {
    return { status: 'processing', elapsedSec: Math.round((Date.now() - job.startedAt) / 1000), caption };
  }
  if (job && job.status === 'failed') return { status: 'failed', error: job.error, caption };
  return { status: 'absent', caption };
}

/** Summary list of all videos — used by GET /api/videos. */
export function listAll() {
  return VIDEO_IDS.map((id) => {
    const ready = isReady(id);
    return {
      id,
      ready,
      status: ready ? 'ready' : (jobs[id] ? jobs[id].status : 'absent'),
      url: ready ? '/videos/' + id + '.mp4' : null,
      caption: captionFor(id),
    };
  });
}

/** How many videos are cached. */
export function readyCount() { return VIDEO_IDS.filter(isReady).length; }

/** Return the absolute file path for streaming. */
export function filePath(id) { return videoPath(id); }

/** Reset in-memory state — for tests only (does not delete cached MP4s). */
export function _resetJobs() {
  for (const k of Object.keys(jobs)) delete jobs[k];
}

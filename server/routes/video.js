// routes/video.js — Video walkthrough endpoints.
//   GET    /api/videos              list all + cache status
//   GET    /api/video/:id           status of one
//   POST   /api/video/:id           start generation (idempotent)
//   GET    /api/video-status/:id    poll status (alias of GET /api/video/:id)
//   GET    /videos/:id.mp4          stream the cached MP4 (range support)

import fs from 'node:fs';
import { sendJSON } from '../lib/http.js';
import { logger } from '../lib/logger.js';
import {
  isKnownVideo, getStatus, startGeneration, listAll, readyCount, filePath, isReady,
} from '../lib/videoStore.js';

const ID_RE = /^[a-z]+$/;

export function videoListRoute(req, res) {
  sendJSON(res, 200, {
    videos: listAll(),
    readyCount: readyCount(),
    total: listAll().length,
  });
}

export async function videoStatusRoute(req, res, params) {
  const { id } = params;
  if (!ID_RE.test(id) || !isKnownVideo(id)) return sendJSON(res, 404, { error: 'unknown emergency id' });
  sendJSON(res, 200, getStatus(id));
}

export async function videoStartRoute(req, res, params) {
  const { id } = params;
  if (!ID_RE.test(id) || !isKnownVideo(id)) return sendJSON(res, 404, { error: 'unknown emergency id' });
  const result = await startGeneration(id);
  sendJSON(res, 200, result);
}

export function videoStreamRoute(req, res, params) {
  const { id } = params;
  if (!ID_RE.test(id) || !isKnownVideo(id) || !isReady(id)) {
    return sendJSON(res, 404, { error: 'video not ready' });
  }
  const fp = filePath(id);
  fs.stat(fp, (err, stat) => {
    if (err) return sendJSON(res, 404, { error: 'video file missing' });
    const range = req.headers && req.headers.range;
    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      if (m) {
        const start = m[1] ? parseInt(m[1], 10) : 0;
        const end = m[2] ? parseInt(m[2], 10) : stat.size - 1;
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${stat.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': end - start + 1,
          'Content-Type': 'video/mp4',
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*',
        });
        fs.createReadStream(fp, { start, end }).pipe(res);
        return;
      }
    }
    res.writeHead(200, {
      'Content-Type': 'video/mp4',
      'Content-Length': stat.size,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*',
    });
    fs.createReadStream(fp).pipe(res);
  });
}

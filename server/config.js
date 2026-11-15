// config.js — Central configuration. All tunable values in one place.

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DOWNLOAD_DIR = path.resolve(ROOT, '..', 'download');
const DATA_DIR = process.env.DB_DIR
  ? path.resolve(process.env.DB_DIR)
  : path.join(ROOT, 'data');

export const config = {
  port: parseInt(process.env.PORT || '8787', 10),
  host: process.env.HOST || '0.0.0.0',

  // Directories
  rootDir: ROOT,
  downloadDir: DOWNLOAD_DIR,
  videosDir: path.join(DOWNLOAD_DIR, 'videos'),
  dataDir: DATA_DIR,

  // Limits
  maxBodyBytes: 15 * 1024 * 1024,          // 15 MB (image data URLs)
  maxImageBytes: 12 * 1024 * 1024,         // 12 MB image cap
  doctorHistoryLimit: 10,                  // keep last N turns of context
  doctorReplyMaxChars: 2200,

  // Video generation
  video: {
    quality: 'speed',
    duration: 5,
    size: '1280x720',
    withAudio: false,
    pollIntervalMs: 8000,
    pollMaxAttempts: 80,
    retryAttempts: 8,
    retryBackoffMs: 30000,
    rateLimitRetryAttempts: 12,
    markerStaleMin: 10,
  },
};

fs.mkdirSync(config.videosDir, { recursive: true });
fs.mkdirSync(config.dataDir, { recursive: true });

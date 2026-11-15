// Pre-generate AI video walkthroughs for all 12 emergencies.
// Resumable: skips any emergency whose MP4 already exists in the videos dir.
// Usage:  node scripts/generate-videos.js [cpr] [burns] ...
// If no args given, generates all missing ones.
//
// Each video: 5s, 1280x720, ~1MB, takes ~1 min to generate.

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import http from 'node:http';
import { VIDEO_PROMPTS, VIDEO_IDS } from './video-prompts.js';
import { config } from '../server/config.js';
import { getZAI } from '../server/lib/zai.js';

const VIDEOS_DIR = config.videosDir;
fs.mkdirSync(VIDEOS_DIR, { recursive: true });

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close(); fs.unlink(dest, () => {});
        return download(res.headers.location, dest).then(resolve, reject);
      }
      if (res.statusCode !== 200) { file.close(); fs.unlink(dest, () => {}); return reject(new Error('HTTP '+res.statusCode)); }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (e) => { file.close(); fs.unlink(dest, () => {}); reject(e); });
  });
}

async function generateOne(id) {
  const prompt = VIDEO_PROMPTS[id];
  if (!prompt) throw new Error('no prompt for ' + id);
  const outPath = path.join(VIDEOS_DIR, id + '.mp4');

  console.log(`\n[${id}] Generating…`);
  console.log(`[${id}] Prompt: ${prompt.slice(0, 90)}…`);
  const t0 = Date.now();

  // Write marker file so the server reports "processing" while we work
  const markerPath = path.join(VIDEOS_DIR, '.' + id + '.generating');
  try { fs.writeFileSync(markerPath, String(Date.now())); } catch {}

  try {
    const zai = await getZAI();

    // Create with retry on 429 (rate limit). Back off up to 5 min.
    let create;
    for (let attempt = 1; attempt <= 12; attempt++) {
      try {
        create = await zai.video.generations.create({
          prompt,
          quality: 'speed',
          duration: 5,
          size: '1280x720',
          with_audio: false,
        });
        break;
      } catch (err) {
        const msg = String(err.message || err);
        if (msg.includes('429') && attempt < 12) {
          const wait = Math.min(120, 20 * attempt);
          console.log(`[${id}] Rate-limited (attempt ${attempt}/12), waiting ${wait}s…`);
          await new Promise(r => setTimeout(r, wait * 1000));
          continue;
        }
        throw err;
      }
    }
    if (!create) throw new Error('create failed after retries');

    const taskId = create.id;
    if (!taskId) throw new Error('no task id returned: ' + JSON.stringify(create));
    console.log(`[${id}] Task ${taskId} — polling…`);

    // Poll until done
    let result = create;
    for (let i = 0; i < 80; i++) {
      await new Promise(r => setTimeout(r, 8000));
      try {
        result = await zai.async.result.query(taskId);
      } catch (err) {
        const msg = String(err.message || err);
        if (msg.includes('429')) { console.log(`[${id}] poll 429, retrying…`); continue; }
        throw err;
      }
      const status = result.task_status;
      process.stdout.write(`\r[${id}] Poll ${i+1}/80: ${status}` + ' '.repeat(10));
      if (status === 'SUCCESS') break;
      if (status === 'FAIL') throw new Error('generation failed: ' + JSON.stringify(result));
    }
    console.log('');

    const videoUrl = (result.video_result && result.video_result[0] && result.video_result[0].url)
      || result.video_url || result.url;
    if (!videoUrl) throw new Error('no video url in result: ' + JSON.stringify(result).slice(0, 300));

    console.log(`[${id}] Downloading from ${videoUrl.slice(0, 80)}…`);
    await download(videoUrl, outPath);
    const sizeKB = (fs.statSync(outPath).size / 1024).toFixed(0);
    const secs = ((Date.now() - t0) / 1000).toFixed(0);
    console.log(`[${id}] ✅ Saved ${outPath} (${sizeKB} KB) in ${secs}s`);
    return outPath;
  } finally {
    // Always clear the marker (success or failure) so the server doesn't hang on "processing"
    try { fs.unlinkSync(markerPath); } catch {}
  }
}

async function main() {
  const args = process.argv.slice(2);
  const ids = args.length ? args : VIDEO_IDS;
  const results = { ok: [], fail: [] };

  for (const id of ids) {
    const outPath = path.join(VIDEOS_DIR, id + '.mp4');
    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 50000) {
      console.log(`[${id}] Already exists (${(fs.statSync(outPath).size/1024).toFixed(0)} KB), skipping.`);
      results.ok.push(id);
      continue;
    }
    if (!VIDEO_PROMPTS[id]) {
      console.log(`[${id}] Unknown emergency id, skipping.`);
      results.fail.push(id + ' (unknown)');
      continue;
    }
    try {
      await generateOne(id);
      results.ok.push(id);
      // Space out requests to respect rate limits (60s between emergencies)
      if (ids.indexOf(id) < ids.length - 1) {
        console.log(`[${id}] Pausing 60s before next emergency…`);
        await new Promise(r => setTimeout(r, 60000));
      }
    } catch (err) {
      console.error(`[${id}] ❌ FAILED: ${err.message}`);
      results.fail.push(id + ' (' + err.message.slice(0, 60) + ')');
      // On failure, wait longer before next attempt
      await new Promise(r => setTimeout(r, 90000));
    }
  }

  console.log('\n=== Summary ===');
  console.log('OK:   ', results.ok.length, results.ok.join(', '));
  console.log('FAIL: ', results.fail.length, results.fail.join(', '));
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });

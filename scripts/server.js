// FirstMinute AI Backend
// Provides: LLM "on-site doctor" chat + VLM camera-vision wound analysis
// Serves the static frontend from the project's download directory.
//
// Run:  node scripts/server.js
// Then open http://localhost:8787/firstminute.html

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { fileURLToPath } from 'node:url';
import https from 'node:https';
import { VIDEO_PROMPTS, VIDEO_CAPTIONS, VIDEO_IDS } from './video-prompts.js';
import { getZAI } from '../server/lib/zai.js';

const PORT = parseInt(process.env.PORT || '8787', 10);
const HOST = process.env.HOST || '0.0.0.0';
const ROOT_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DOWNLOAD_DIR = path.join(ROOT_DIR, 'download');
const VIDEOS_DIR = path.join(DOWNLOAD_DIR, 'videos');
fs.mkdirSync(VIDEOS_DIR, { recursive: true });

// ---------- System prompt for the on-site doctor ----------
const DOCTOR_SYSTEM = `You are "FirstMinute Doctor", an AI first-aid assistant embedded in an emergency app used by ordinary Nigerians. You help a layperson at the scene of a medical emergency.

YOUR ROLE
- Give calm, practical, step-by-step first-aid guidance a non-medical person can follow right now, with their hands.
- Speak plainly, in short sentences. No medical jargon without explaining it.
- Be decisive: tell them exactly what to do, in order. Do not give long disclaimers first.
- Adapt to what they say (symptoms, age, what happened, what supplies they have).

SAFETY RULES (non-negotiable)
- If the situation may be life-threatening (not breathing, unresponsive, severe bleeding, choking, snake/scorpion bite, stroke signs, severe burn, seizure, poisoning, chest pain, anaphylaxis), your FIRST line must tell them to call 112 (or 767 in Lagos) immediately, and to keep the line free.
- Never recommend giving a medication by mouth, injecting anything, inducing vomiting, giving food/water to an unconscious person, or any invasive procedure. Leave those to trained responders.
- Never claim to diagnose. Say what it "may be" and what to watch for, and that a clinician must confirm.
- If you are unsure or the case is beyond first aid, say so and tell them to call 112 / go to a hospital.
- You are not a replacement for professional medical care. You support, you do not replace.

FORMAT (keep it tight, scannable)
1. If life-threatening, start with one line in caps: "🚨 CALL 112 NOW — then continue."
2. Then 3–6 numbered steps of what to do right now. One action per step.
3. Then a short "Watch for:" line listing danger signs that mean call 112 / hurry.
4. End with one reassuring, practical sentence. No "disclaimer" boilerplate.

Keep total reply under ~220 words. If they ask something outside first aid, gently steer back to the emergency at hand.`;

// ---------- Helpers ----------
function readBody(req, limit = 15 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function sendStatic(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) { sendJSON(res, 404, { error: 'not found' }); return; }
    const ext = path.extname(filePath).toLowerCase();
    const types = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
      '.md': 'text/markdown; charset=utf-8',
    };
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

// ---------- Endpoints ----------
async function handleDoctor(req, res) {
  let payload;
  try { payload = JSON.parse((await readBody(req)).toString()); }
  catch { return sendJSON(res, 400, { error: 'invalid JSON' }); }

  const history = Array.isArray(payload.history) ? payload.history : [];
  const message = (payload.message || '').toString().trim();
  const context = payload.context || ''; // optional: e.g. selected emergency

  if (!message && history.length === 0) {
    return sendJSON(res, 400, { error: 'message required' });
  }

  const messages = [{ role: 'assistant', content: DOCTOR_SYSTEM }];
  if (context) {
    messages.push({ role: 'assistant', content: `Context the user is in: ${context}. Tailor your guidance to this.` });
  }
  for (const m of history.slice(-10)) {
    if (m.role && m.content) messages.push({ role: m.role, content: String(m.content) });
  }
  if (message) messages.push({ role: 'user', content: message });

  try {
    const zai = await getZAI();
    const completion = await zai.chat.completions.create({
      messages,
      thinking: { type: 'disabled' },
    });
    const reply = completion.choices?.[0]?.message?.content || '';
    sendJSON(res, 200, { reply });
  } catch (err) {
    console.error('doctor error:', err?.message || err);
    sendJSON(res, 500, { error: 'AI request failed', detail: String(err?.message || err).slice(0, 200) });
  }
}

async function handleAnalyze(req, res) {
  let payload;
  try { payload = JSON.parse((await readBody(req)).toString()); }
  catch { return sendJSON(res, 400, { error: 'invalid JSON' }); }

  const image = (payload.image || '').toString();
  const question = (payload.question || '').toString().trim()
    || "This is a photo taken at the scene of a possible injury. Describe what you see on the skin/body: type (wound, burn, rash, bite, swelling, bruise, foreign object, or none), approximate size, location on the body if identifiable, color, and any visible severity signs (deep tissue, large area, dirt/debris, active bleeding). Be factual and brief. Then suggest which first-aid category this most likely maps to.";

  if (!image || !image.startsWith('data:image/')) {
    return sendJSON(res, 400, { error: 'image (data URL) required' });
  }

  const visionPrompt = `You are the camera-vision aid of an emergency first-aid app. You MUST follow these rules strictly:
- You are NOT a doctor and you do NOT diagnose. You describe what is visible and suggest a likely first-aid category for the layperson to follow.
- Never tell the user a condition is "fine", "not serious", or "safe". Always say a clinician must confirm.
- If you see something that may be life-threatening (heavy bleeding, deep wound, large burn, swollen airway, snake/scorpion bite), say so and tell them to call 112.
- If the image is unclear, dark, blurry, or not a body part, say so and ask them to retake it: good light, ~30 cm away, steady.
- Keep the description under ~150 words. Use short bullets.

${question}`;

  try {
    const zai = await getZAI();
    const response = await zai.chat.completions.createVision({
      model: 'glm-4.6v',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: visionPrompt },
          { type: 'image_url', image_url: { url: image } },
        ],
      }],
      thinking: { type: 'disabled' },
    });
    const reply = response.choices?.[0]?.message?.content || '';
    sendJSON(res, 200, { description: reply });
  } catch (err) {
    console.error('analyze error:', err?.message || err);
    sendJSON(res, 500, { error: 'vision request failed', detail: String(err?.message || err).slice(0, 200) });
  }
}

// ---------- AI Video walkthroughs ----------
// State of in-flight generations: { [id]: { status, taskId, startedAt, error } }
const videoJobs = {};

function downloadVideoFile(videoUrl, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const client = videoUrl.startsWith('https') ? https : http;
    client.get(videoUrl, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close(); fs.unlink(dest, () => {});
        return downloadVideoFile(res.headers.location, dest).then(resolve, reject);
      }
      if (res.statusCode !== 200) { file.close(); fs.unlink(dest, () => {}); return reject(new Error('HTTP ' + res.statusCode)); }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (e) => { file.close(); fs.unlink(dest, () => {}); reject(e); });
  });
}

function videoPath(id) { return path.join(VIDEOS_DIR, id + '.mp4'); }
function videoReady(id) {
  try { return fs.existsSync(videoPath(id)) && fs.statSync(videoPath(id)).size > 20000; }
  catch { return false; }
}

// Kick off generation for an emergency id (idempotent — only starts if not already running/ready).
async function startVideoJob(id) {
  if (!VIDEO_PROMPTS[id]) return { error: 'unknown emergency id' };
  if (videoReady(id)) { clearMarker(id); return { status: 'ready', url: '/videos/' + id + '.mp4' }; }
  // If a background generator (separate process) is already working on this, just report processing.
  if (isGenerating(id)) return { status: 'processing' };
  if (videoJobs[id] && videoJobs[id].status === 'processing') return { status: 'processing', jobId: videoJobs[id].taskId };

  videoJobs[id] = { status: 'processing', taskId: null, startedAt: Date.now(), error: null };
  writeMarker(id);
  const zai = await getZAI();
  const prompt = VIDEO_PROMPTS[id];

  (async () => {
    try {
      // Create with retry on rate-limit
      let create;
      for (let attempt = 1; attempt <= 8; attempt++) {
        try {
          create = await zai.video.generations.create({
            prompt, quality: 'speed', duration: 5, size: '1280x720', with_audio: false,
          });
          break;
        } catch (err) {
          if (String(err.message).includes('429') && attempt < 8) {
            await new Promise(r => setTimeout(r, 30000 * attempt));
            continue;
          }
          throw err;
        }
      }
      if (!create || !create.id) throw new Error('no task id returned');
      videoJobs[id].taskId = create.id;

      // Poll
      let result = create;
      for (let i = 0; i < 80; i++) {
        await new Promise(r => setTimeout(r, 8000));
        try { result = await zai.async.result.query(create.id); }
        catch (err) { if (String(err.message).includes('429')) continue; throw err; }
        if (result.task_status === 'SUCCESS') break;
        if (result.task_status === 'FAIL') throw new Error('generation failed');
      }
      const videoUrl = (result.video_result && result.video_result[0] && result.video_result[0].url)
        || result.video_url || result.url;
      if (!videoUrl) throw new Error('no video url in result');

      await downloadVideoFile(videoUrl, videoPath(id));
      if (!videoReady(id)) throw new Error('downloaded file too small');
      videoJobs[id].status = 'ready';
      clearMarker(id);
      console.log(`[video:${id}] ready`);
    } catch (err) {
      videoJobs[id].status = 'failed';
      videoJobs[id].error = String(err.message || err).slice(0, 200);
      clearMarker(id);
      console.error(`[video:${id}] failed:`, videoJobs[id].error);
    }
  })();

  return { status: 'processing' };
}

// Marker file written when ANY process (background generator or server) is generating a video.
// This lets the server report "processing" even if the generation runs in a separate process.
function markerPath(id) { return path.join(VIDEOS_DIR, '.' + id + '.generating'); }
function isGenerating(id) {
  try {
    const mp = markerPath(id);
    if (!fs.existsSync(mp)) return false;
    // Stale marker > 10 min → treat as not generating
    const ageMin = (Date.now() - fs.statSync(mp).mtimeMs) / 60000;
    if (ageMin > 10) { try { fs.unlinkSync(mp); } catch {} return false; }
    return true;
  } catch { return false; }
}
function writeMarker(id) { try { fs.writeFileSync(markerPath(id), String(Date.now())); } catch {} }
function clearMarker(id) { try { fs.unlinkSync(markerPath(id)); } catch {} }

function handleVideoStatus(req, res, id) {
  if (!VIDEO_PROMPTS[id]) return sendJSON(res, 404, { error: 'unknown emergency id' });
  if (videoReady(id)) {
    clearMarker(id);
    return sendJSON(res, 200, {
      status: 'ready',
      url: '/videos/' + id + '.mp4',
      caption: VIDEO_CAPTIONS[id],
    });
  }
  // File-based generating marker (works across processes)
  if (isGenerating(id)) {
    return sendJSON(res, 200, { status: 'processing', caption: VIDEO_CAPTIONS[id], note: 'generating' });
  }
  const job = videoJobs[id];
  if (job && job.status === 'processing') {
    const elapsed = Math.round((Date.now() - job.startedAt) / 1000);
    return sendJSON(res, 200, { status: 'processing', elapsedSec: elapsed, caption: VIDEO_CAPTIONS[id] });
  }
  if (job && job.status === 'failed') {
    return sendJSON(res, 200, { status: 'failed', error: job.error, caption: VIDEO_CAPTIONS[id] });
  }
  return sendJSON(res, 200, { status: 'absent', caption: VIDEO_CAPTIONS[id] });
}

async function handleVideoStart(req, res, id) {
  if (!VIDEO_PROMPTS[id]) return sendJSON(res, 404, { error: 'unknown emergency id' });
  const result = await startVideoJob(id);
  return sendJSON(res, 200, { ...result, caption: VIDEO_CAPTIONS[id] });
}

function handleVideoList(res) {
  const list = VIDEO_IDS.map(id => ({
    id,
    ready: videoReady(id),
    status: videoReady(id) ? 'ready' : (videoJobs[id] ? videoJobs[id].status : 'absent'),
    url: videoReady(id) ? '/videos/' + id + '.mp4' : null,
    caption: VIDEO_CAPTIONS[id],
  }));
  sendJSON(res, 200, { videos: list });
}

function sendVideoFile(req, res, id) {
  const fp = videoPath(id);
  if (!videoReady(id)) return sendJSON(res, 404, { error: 'video not ready' });
  fs.stat(fp, (err, stat) => {
    if (err) return sendJSON(res, 404, { error: 'video file missing' });
    const range = req.headers && req.headers.range;
    if (range) {
      // Support byte-range requests for video streaming
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      if (m) {
        const start = m[1] ? parseInt(m[1], 10) : 0;
        const end = m[2] ? parseInt(m[2], 10) : stat.size - 1;
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${stat.size}`,
          'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1,
          'Content-Type': 'video/mp4', 'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*',
        });
        fs.createReadStream(fp, { start, end }).pipe(res);
        return;
      }
    }
    res.writeHead(200, {
      'Content-Type': 'video/mp4', 'Content-Length': stat.size,
      'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*',
    });
    fs.createReadStream(fp).pipe(res);
  });
}

// ---------- HTTP server ----------
const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = decodeURIComponent(parsed.pathname);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Range',
    });
    return res.end();
  }

  if (req.method === 'POST' && pathname === '/api/doctor') return handleDoctor(req, res);
  if (req.method === 'POST' && pathname === '/api/analyze') return handleAnalyze(req, res);

  // Video walkthrough endpoints
  const videoMatch = /^\/api\/video(?:-status)?\/([a-z]+)$/.exec(pathname);
  if (videoMatch) {
    const id = videoMatch[1];
    if (req.method === 'POST' && pathname.startsWith('/api/video-status/')) return handleVideoStatus(req, res, id);
    if (req.method === 'GET' && pathname.startsWith('/api/video-status/')) return handleVideoStatus(req, res, id);
    if (req.method === 'POST' && pathname.startsWith('/api/video/')) return handleVideoStart(req, res, id);
    if (req.method === 'GET' && pathname.startsWith('/api/video/')) return handleVideoStatus(req, res, id);
  }
  if (req.method === 'GET' && pathname === '/api/videos') return handleVideoList(res);
  if (req.method === 'GET' && /^\/videos\/[a-z]+\.mp4$/.test(pathname)) {
    return sendVideoFile(req, res, pathname.slice('/videos/'.length, -4));
  }

  if (req.method === 'GET') {
    let filePath;
    if (pathname === '/' || pathname === '/firstminute' || pathname === '/firstminute.html') {
      filePath = path.join(DOWNLOAD_DIR, 'firstminute.html');
    } else if (pathname === '/README.md' || pathname === '/readme.md') {
      filePath = path.join(DOWNLOAD_DIR, 'README.md');
    } else {
      filePath = path.join(DOWNLOAD_DIR, path.normalize(pathname));
    }
    if (!filePath.startsWith(DOWNLOAD_DIR)) return sendJSON(res, 403, { error: 'forbidden' });
    return sendStatic(res, filePath);
  }

  sendJSON(res, 404, { error: 'not found' });
});

server.listen(PORT, HOST, () => {
  console.log(`FirstMinute AI backend running:`);
  console.log(`  App:        http://localhost:${PORT}/firstminute.html`);
  console.log(`  Doctor:     POST http://localhost:${PORT}/api/doctor`);
  console.log(`  Analyze:    POST http://localhost:${PORT}/api/analyze`);
  console.log(`  Videos:     GET  http://localhost:${PORT}/api/videos`);
  console.log(`              POST http://localhost:${PORT}/api/video/:id (start)`);
  console.log(`              GET  http://localhost:${PORT}/api/video-status/:id (poll)`);
  console.log(`              GET  http://localhost:${PORT}/videos/:id.mp4 (stream)`);
  const readyCount = VIDEO_IDS.filter(videoReady).length;
  console.log(`  Video cache: ${readyCount}/${VIDEO_IDS.length} ready in ${VIDEOS_DIR}`);
});

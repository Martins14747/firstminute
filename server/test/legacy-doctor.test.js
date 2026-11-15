import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PORT = process.env.TEST_LEGACY_PORT || '9798';
const BASE = `http://localhost:${PORT}`;
const SERVER_PATH = fileURLToPath(new URL('../../scripts/server.js', import.meta.url));

let serverProc;

before(async () => {
  serverProc = spawn(process.execPath, [SERVER_PATH], {
    env: {
      ...process.env,
      PORT,
      LOG_LEVEL: 'error',
      FIRSTMINUTE_DOCJR_USE_LLM: 'false',
      FIRSTMINUTE_ALLOW_DRAFT_PROTOCOLS: 'true',
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  });

  for (let i = 0; i < 40; i++) {
    try {
      const response = await fetch(`${BASE}/firstminute.html`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('legacy server did not start');
});

after(() => { if (serverProc) serverProc.kill(); });

test('legacy server routes doctor requests through Doc. Jr', async () => {
  const response = await fetch(`${BASE}/api/doctor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'A deep cut is bleeding heavily' }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.triage.protocol.protocol_id, 'BLEEDING-001');
  assert.match(body.reply, /not been clinically reviewed/i);
});

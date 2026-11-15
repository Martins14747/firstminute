// test/data.test.js — Unit tests for the data layer (emergencies, hospitals, prompts).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMERGENCIES, EMERGENCY_IDS, getEmergency, searchEmergencies } from '../data/emergencies.js';
import { HOSPITALS, HOSPITAL_IDS, getHospital, listHospitals, listStates } from '../data/hospitals.js';
import { VIDEO_PROMPTS, VIDEO_CAPTIONS, VIDEO_IDS, getVideoPrompt, getVideoCaption } from '../data/video-prompts.js';
import { DOCTOR_SYSTEM, VISION_BASE, DEFAULT_VISION_QUESTION } from '../data/prompts.js';

test('emergencies: 12 emergencies with full structure', () => {
  assert.equal(EMERGENCIES.length, 12);
  assert.equal(EMERGENCY_IDS.length, 12);
  for (const e of EMERGENCIES) {
    assert.ok(e.id, 'has id');
    assert.ok(e.name, 'has name');
    assert.ok(e.icon, 'has icon');
    assert.ok(['high', 'med', 'low'].includes(e.sev), 'valid severity');
    assert.ok(Array.isArray(e.tags) && e.tags.length > 0, 'has tags');
    assert.ok(Array.isArray(e.steps) && e.steps.length >= 6, 'has ≥6 steps');
    assert.ok(Array.isArray(e.alts) && e.alts.length >= 3, 'has ≥3 alternatives');
    assert.ok(e.what, 'has description');
    assert.ok(e.danger, 'has danger signs');
  }
});

test('emergencies: getEmergency returns by id', () => {
  assert.equal(getEmergency('cpr').name, 'Cardiac Arrest / CPR');
  assert.equal(getEmergency('snake').name, 'Snake Bite');
  assert.equal(getEmergency('nonexistent'), null);
});

test('emergencies: searchEmergencies matches name + tags', () => {
  assert.equal(searchEmergencies('snake').length, 1);
  assert.equal(searchEmergencies('burn').length, 1);
  assert.equal(searchEmergencies('cpr').length, 1);
  assert.equal(searchEmergencies('').length, 12);
  assert.equal(searchEmergencies('xyznotreal').length, 0);
});

test('hospitals: 30 hospitals with coordinates + phone', () => {
  assert.equal(HOSPITALS.length, 30);
  for (const h of HOSPITALS) {
    assert.ok(h.id, 'has id');
    assert.ok(h.n, 'has name');
    assert.ok(h.s, 'has state');
    assert.ok(h.t, 'has emergency number');
    assert.ok(h.p, 'has phone');
    assert.equal(typeof h.lat, 'number');
    assert.equal(typeof h.lng, 'number');
    assert.ok(h.lat >= 4 && h.lat <= 14, 'lat in Nigeria range');
    assert.ok(h.lng >= 3 && h.lng <= 15, 'lng in Nigeria range');
  }
});

test('hospitals: listHospitals sorts by distance', () => {
  const list = listHospitals({ lat: 9.076, lng: 7.484, limit: 3 }); // Abuja
  assert.equal(list.length, 3);
  assert.ok(list[0].distanceKm <= list[1].distanceKm, 'sorted ascending');
  assert.ok(list[0].n.includes('Abuja'), 'nearest is Abuja');
});

test('hospitals: listHospitals filters by state', () => {
  const lagos = listHospitals({ state: 'Lagos' });
  assert.equal(lagos.length, 4);
  assert.ok(lagos.every((h) => h.s === 'Lagos'));
});

test('hospitals: getHospital + listStates', () => {
  assert.ok(getHospital('luth'));
  assert.equal(getHospital('luth').s, 'Lagos');
  assert.equal(getHospital('nope'), null);
  const states = listStates();
  assert.ok(states.length >= 20);
  assert.ok(states.includes('Lagos'));
  assert.ok(states.includes('FCT'));
});

test('video prompts: 12 prompts with matching captions', () => {
  assert.equal(VIDEO_IDS.length, 12);
  assert.equal(Object.keys(VIDEO_PROMPTS).length, 12);
  assert.equal(Object.keys(VIDEO_CAPTIONS).length, 12);
  for (const id of VIDEO_IDS) {
    assert.ok(VIDEO_PROMPTS[id], `prompt for ${id}`);
    assert.ok(VIDEO_CAPTIONS[id], `caption for ${id}`);
    // Every emergency has a video prompt
    assert.ok(EMERGENCY_IDS.includes(id), `${id} matches an emergency`);
  }
});

test('video prompts: clinical tone — no gore depictions', () => {
  // Banned as depictions (prompts must NOT ask the model to show these).
  // The word "blood" may appear in a negation like "no blood shown".
  const bannedPhrases = ['show blood', 'graphic injury', 'severed', 'mutilated', 'real wound', 'bleeding wound', 'gore'];
  for (const [id, prompt] of Object.entries(VIDEO_PROMPTS)) {
    const lower = prompt.toLowerCase();
    for (const phrase of bannedPhrases) {
      assert.ok(!lower.includes(phrase), `${id} prompt must not depict "${phrase}"`);
    }
    // Every prompt must be explicitly clinical / instructional
    assert.ok(
      lower.includes('clinical') || lower.includes('instructional') || lower.includes('training') || lower.includes('manikin') || lower.includes('prop') || lower.includes('clean') || lower.includes('calm'),
      `${id} prompt sets a clinical tone`
    );
  }
});

test('prompts: doctor system prompt has safety rules', () => {
  assert.ok(DOCTOR_SYSTEM.includes('112'), 'mentions emergency number 112');
  assert.ok(DOCTOR_SYSTEM.includes('CALL 112 NOW'), 'has call-112 directive');
  assert.ok(DOCTOR_SYSTEM.includes('not a replacement'), 'has disclaimer');
  assert.ok(DOCTOR_SYSTEM.includes('Never recommend'), 'has safety rules');
  assert.ok(DOCTOR_SYSTEM.length > 500, 'substantial prompt');
});

test('prompts: vision base has no-diagnosis rule', () => {
  assert.ok(VISION_BASE.includes('NOT a doctor'));
  assert.ok(VISION_BASE.includes('do NOT diagnose'));
  assert.ok(VISION_BASE.includes('clinician must confirm'));
  assert.ok(VISION_BASE.includes('call 112'));
  assert.ok(DEFAULT_VISION_QUESTION.length > 50);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
const DOCJR_DIR = path.join(SERVER_DIR, '..', 'docjr');
const require = createRequire(import.meta.url);
const { DocJr } = require(path.join(DOCJR_DIR, 'src', 'orchestrator.cjs'));
const scenarios = readFileSync(path.join(DOCJR_DIR, 'scenarios', 'eval_scenarios.jsonl'), 'utf8')
  .trim().split(/\r?\n/).map((line) => JSON.parse(line));

test('integrated evaluation corpus contains 100 unique scenarios', () => {
  assert.equal(scenarios.length, 100);
  assert.equal(new Set(scenarios.map((scenario) => scenario.scenario_id)).size, 100);
});

test('integrated Doc. Jr matches all evaluation protocols and escalates life threats', async () => {
  const docjr = new DocJr({ useLLM: false });
  const mismatches = [];
  const missedEscalations = [];

  for (const scenario of scenarios) {
    const result = await docjr.process(scenario.description, { ageGroup: scenario.age_group });
    if (result.protocol?.protocol_id !== scenario.protocol_reference) {
      mismatches.push({
        id: scenario.scenario_id,
        expected: scenario.protocol_reference,
        actual: result.protocol?.protocol_id || null,
      });
    }
    if (scenario.risk_level === 'life_threatening' && !result.safety.must_escalate) {
      missedEscalations.push(scenario.scenario_id);
    }
  }

  assert.deepEqual(mismatches, []);
  assert.deepEqual(missedEscalations, []);
});

test('an incidental snake mention does not override clear fracture evidence', async () => {
  const docjr = new DocJr({ useLLM: false });
  const result = await docjr.process('A snake was nearby, but my leg is broken');
  assert.equal(result.protocol?.protocol_id, 'FRACTURE-001');
});

test('trusted references are searched only for unanswered non-urgent questions', async () => {
  const queries = [];
  const docjr = new DocJr({
    useLLM: false,
    referenceSearch: {
      async search(query) {
        queries.push(query);
        return { status: 'found', results: [{ title: 'Eczema', url: 'https://medlineplus.gov/eczema.html' }] };
      },
    },
  });

  const question = await docjr.process('What is eczema?', { referenceQuery: 'What is eczema?' });
  assert.equal(question.reference_search.status, 'found');
  assert.deepEqual(queries, ['What is eczema?']);

  const knownEmergency = await docjr.process('A deep cut is bleeding heavily?');
  assert.equal(knownEmergency.protocol?.protocol_id, 'BLEEDING-001');
  assert.equal(knownEmergency.reference_search, null);

  const urgent = await docjr.process('The person is unconscious. What should I do?');
  assert.equal(urgent.safety.must_escalate, true);
  assert.equal(urgent.reference_search, null);

  const actionableQuestion = await docjr.process('What should I do about chest pain?');
  assert.equal(actionableQuestion.reference_search, null);

  const historyOnly = await docjr.process('What is eczema?', { referenceQuery: '' });
  assert.equal(historyOnly.reference_search, null);
  assert.deepEqual(queries, ['What is eczema?']);
});

test('Doc. Jr preserves the validated non-medical conversation intent', async () => {
  const docjr = new DocJr({
    classify: async () => ({
      ok: true,
      response: {
        intent: 'general_nonmedical',
        likely_category: 'unclear',
        confidence: 0.9,
        extracted_symptoms: [],
        extracted_age_group: 'unknown',
        clarification_questions: [],
        requires_escalation: false,
        escalation_reason: null,
        notes: null,
      },
    }),
  });
  const result = await docjr.process('Tell me a fun fact');
  assert.equal(result.classification.intent, 'general_nonmedical');
  assert.equal(result.classification.llm_used, true);
  assert.equal(result.protocol, null);
});

// routes/doctor.js — POST /api/doctor
// Uses Doc. Jr for triage and renders only deterministic protocol instructions.

import { createRequire } from 'node:module';
import { readJSON, sendJSON } from '../lib/http.js';
import { getEmergency } from '../data/emergencies.js';
import { logger } from '../lib/logger.js';

const require = createRequire(import.meta.url);
const { DocJr } = require('../docjr/src/orchestrator.cjs');
const { MedlinePlusReferenceSearch } = require('../docjr/src/reference_search.cjs');
const { converse } = require('../docjr/src/llm_client.cjs');

const docjr = new DocJr({
  useLLM: process.env.FIRSTMINUTE_DOCJR_USE_LLM !== 'false',
  includeDraft: process.env.NODE_ENV !== 'production'
    || process.env.FIRSTMINUTE_ALLOW_DRAFT_PROTOCOLS === 'true',
  referenceSearch: process.env.FIRSTMINUTE_REFERENCE_LOOKUP === 'false'
    ? null
    : new MedlinePlusReferenceSearch(),
});

export function shouldUseGeneralChat(result, context = '') {
  return result.classification.intent === 'general_nonmedical'
    && result.classification.llm_used === true
    && result.classification.category === 'unclear'
    && !result.classification.unsupported_category
    && !result.protocol
    && !result.safety.must_escalate
    && !context;
}

function formatReply(result, draftAllowed) {
  const sections = [];

  if (result.safety.must_escalate) {
    sections.push(result.safety.escalation_message);
    const contacts = result.emergency_contacts || {};
    sections.push(`**Emergency contacts:** ${Object.values(contacts)
      .map((contact) => `${contact.name}: ${contact.number}`)
      .join(' · ')}`);
  }
  sections.push('I’m here with you. Take one slow breath if you can; we’ll go one step at a time.');

  const protocol = result.protocol;
  if (!protocol) {
    if (result.classification.unsupported_category) {
      const emergencyName = result.classification.unsupported_category === 'stroke' ? 'Stroke' : 'Heat stroke';
      sections.push(`${emergencyName} is not yet covered by a Doc. Jr protocol, so I cannot provide protocol instructions.`);
    } else if (!draftAllowed && result.classification.category !== 'unclear') {
      sections.push('A matching first-aid protocol is available, but it has not been approved for production use, so I cannot provide its instructions.');
    } else {
      sections.push('I could not reliably match this to a Doc. Jr protocol. I cannot diagnose or safely give unmatched treatment instructions.');
    }
    sections.push('If this may be an emergency, call 112 now. Otherwise, describe what happened, the person’s age, and their symptoms.');
    const referenceSearch = result.reference_search;
    if (referenceSearch?.status === 'found') {
      sections.push(`**Trusted reference results** (background information only, not first-aid instructions):\n${referenceSearch.results
        .map((item) => `- [${item.title}](${item.url})${item.summary ? ` — ${item.summary}` : ''}`)
        .join('\n')}`);
    } else if (referenceSearch?.status === 'no_results') {
      sections.push('I couldn’t find a matching MedlinePlus reference. I won’t guess; please contact a health professional for advice.');
    } else if (referenceSearch?.status === 'unavailable') {
      sections.push('I couldn’t reach the trusted medical reference service just now. I won’t guess; please contact a health professional for advice.');
    }
    const questions = result.extracted?.clarification_questions || [];
    if (questions.length) {
      sections.push(`To help identify the right protocol:\n${questions.map((question) => `- ${question}`).join('\n')}`);
    }
    return sections.join('\n\n');
  }

  if (protocol.warning) {
    sections.push(`⚠️ **${protocol.warning} This guidance is draft, has not been clinically reviewed, and is not approved for production use.**`);
  }

  sections.push(`**${protocol.title}** (${protocol.protocol_id}, ${protocol.publication_status})`);
  if (protocol.age_pathway) sections.push(`**Age-specific guidance:** ${protocol.age_pathway}`);

  const warnings = protocol.immediate_safety_warnings || [];
  if (warnings.length) {
    sections.push(`**Safety warnings:**\n${warnings.map((warning) => `- ${warning}`).join('\n')}`);
  }

  const instructions = protocol.ordered_instructions || [];
  if (instructions.length) {
    sections.push(`**Steps:**\n${instructions.map((step) => (
      `${step.step}. ${step.instruction}${step.rationale ? `\n   ${step.rationale}` : ''}`
    )).join('\n')}`);
  }

  const alternatives = protocol.approved_alternatives || [];
  if (alternatives.length) {
    sections.push(`**If supplies are unavailable:**\n${alternatives.map((item) => (
      `- ${item.standard}: ${item.alternative}`
    )).join('\n')}`);
  }

  const avoid = protocol.actions_to_avoid || [];
  if (avoid.length) {
    sections.push(`**Do not:**\n${avoid.map((action) => `- ${action}`).join('\n')}`);
  }

  const questions = result.extracted?.clarification_questions || [];
  if (questions.length) {
    sections.push(`**Questions:**\n${questions.map((question) => `- ${question}`).join('\n')}`);
  }

  return sections.join('\n\n');
}

export async function doctorRoute(req, res) {
  const { ok, data, error } = await readJSON(req);
  if (!ok) return sendJSON(res, 400, { error });

  const history = Array.isArray(data.history) ? data.history : [];
  const message = String(data.message || '').trim();
  const context = String(data.context || '').trim();

  if (!message && history.length === 0) {
    return sendJSON(res, 400, { error: 'message required' });
  }

  const contextEmergency = getEmergency(context);
  const contextText = contextEmergency
    ? `Current emergency: ${contextEmergency.name}. ${contextEmergency.what} Danger signs: ${contextEmergency.danger}`
    : context ? `Current emergency context: ${context}` : '';
  const userHistory = history
    .filter((turn) => turn && turn.role === 'user' && turn.content)
    .map((turn) => String(turn.content).trim())
    .filter((content) => content && content !== message)
    .slice(-5);
  const conversationHistory = history
    .filter((turn) => turn && ['user', 'assistant'].includes(turn.role) && typeof turn.content === 'string')
    .slice(-12)
    .map((turn) => ({ role: turn.role, content: turn.content.slice(-1200) }));
  const userText = [contextText, ...userHistory, message].filter(Boolean).join('\n').slice(-6000);
  const preferences = String(data.preferences || '').trim().slice(0, 180);

  try {
    const result = await docjr.process(userText, { referenceQuery: message });
    const reply = shouldUseGeneralChat(result, contextText)
      ? await converse(message || userHistory[userHistory.length - 1], {
        history: conversationHistory,
        preferences,
      })
      : formatReply(result, docjr.includeDraft);
    if (result.reference_search?.status === 'unavailable') {
      logger.warn('trusted reference lookup unavailable', { error: result.reference_search.error });
    }
    logger.info('doctor triage', {
      requestId: result.request_id,
      category: result.classification.category,
      source: result.classification.source,
      intent: result.classification.intent,
      protocolId: result.protocol?.protocol_id || null,
      escalated: result.safety.must_escalate,
      referenceStatus: result.reference_search?.status || 'not_needed',
      latencyMs: result.latency_ms,
    });
    return sendJSON(res, 200, {
      reply,
      triage: {
        request_id: result.request_id,
        classification: {
          category: result.classification.category,
          confidence: result.classification.confidence,
          source: result.classification.source,
          unsupported_category: result.classification.unsupported_category,
          llm_used: result.classification.llm_used,
        },
        safety: result.safety,
        reference_search: result.reference_search
          ? { status: result.reference_search.status, results: result.reference_search.results }
          : null,
        protocol: result.protocol ? {
          protocol_id: result.protocol.protocol_id,
          title: result.protocol.title,
          publication_status: result.protocol.publication_status,
          warning: result.protocol.warning,
          source_references: result.protocol.source_references,
        } : null,
      },
    });
  } catch (err) {
    logger.error('doctor error', { error: String(err.message || err).slice(0, 200) });
    return sendJSON(res, 500, { error: 'AI request failed', detail: String(err.message || err).slice(0, 200) });
  }
}

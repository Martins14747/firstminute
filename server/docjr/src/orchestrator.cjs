// src/orchestrator.cjs — The Doc. Jr orchestrator.
// Combines: SafetyModule (pre-check) → LLM classify → Retriever (RAG) →
// ProtocolEngine (select + instructions) → SafetyModule (post-validate + enforce escalation).
// Returns a single governed response the UI can display.

const { ProtocolEngine } = require("./protocol_engine.cjs");
const { Retriever } = require("./retriever.cjs");
const { SafetyModule } = require("./safety.cjs");
const llm = require("./llm_client.cjs");

// Nigeria emergency contacts (verified — see SPECIFICATION §7).
const NIGERIA_CONTACTS = {
  national: { name: "National Emergency Number", number: "112", note: "Toll-free, all networks, routes police/fire/medical" },
  fmoh_medical: { name: "FMOH Emergency Medical Care", number: "122", note: "Federal Ministry of Health medical line" },
  lagos: { name: "LASEMA (Lagos)", number: "767", note: "Lagos State toll-free emergency line" },
  ncdc: { name: "NCDC Public Health", number: "6232", note: "Public health emergencies" },
};

function detectUnsupportedEmergency(text) {
  const input = (text || "").toLowerCase();
  if (/\bheat\s*stroke\b|\bheat exhaustion\b/.test(input)) return "heat_stroke";
  if (/\bstroke\b|\bface droop(?:ing)?\b|\bslurred speech\b|\bweak arm\b|\bone[- ]sided weakness\b/.test(input)) {
    return "stroke";
  }
  return null;
}

class DocJr {
  constructor(opts = {}) {
    this.engine = new ProtocolEngine(opts.protocolsDir);
    this.retriever = new Retriever(opts.protocolsDir);
    this.safety = new SafetyModule();
    this.useLLM = opts.useLLM !== false; // can disable for offline/eval
    this.includeDraft = opts.includeDraft !== false; // MVP: draft protocols usable
    this.referenceSearch = opts.referenceSearch || null;
    this.classify = opts.classify || llm.classify;
  }

  /**
   * Main entry: process a user's emergency description.
   * @param {string} userText
   * @param {object} ctx - { ageGroup, history }
   * @returns {object} governed response
   */
  async process(userText, ctx = {}) {
    const ageGroup = ctx.ageGroup || (/\b(infant|newborn|baby)\b/i.test(userText) ? "infant" :
      /\b(child|children|kid|son|daughter)\b/i.test(userText) ? "child" : "adult");
    const startedAt = Date.now();

    // 1. PRE-CHECK safety: detect life-threatening signals BEFORE any LLM call.
    // This guarantees the protocol engine never waits on the LLM for escalation.
    const lifeThreat = this.safety.detectLifeThreatening(userText);
    const mustEscalatePre = lifeThreat.length > 0;
    const unsupportedEmergency = detectUnsupportedEmergency(userText);

    // 2. RAG retrieval (deterministic, offline-capable)
    const ragResults = unsupportedEmergency ? [] : this.retriever.retrieve(userText, 3);
    const ragBest = ragResults[0] || null;

    // 3. LLM classification (if enabled)
    let llmResult = null;
    if (this.useLLM) {
      try {
        llmResult = await this.classify(userText, { maxRetries: 2 });
      } catch (e) {
        llmResult = { ok: false, errors: [e.message] };
      }
    }

    let llmResponseValid = false;
    let safetyFlags = [];
    if (llmResult?.ok) {
      const validation = this.safety.validateResponse(llmResult.response);
      llmResponseValid = validation.valid;
      if (!validation.valid) {
        safetyFlags.push(`FORBIDDEN_RECOMMENDATION_REJECTED: ${validation.violations.join(", ")}`);
      }
    }

    // 4. Decide the category:
    //    - If RAG and LLM agree, use that.
    //    - If they disagree, prefer the LLM but note the disagreement.
    //    - If LLM fails entirely, fall back to RAG.
    let category = null;
    let categorySource = null;
    let confidence = 0;
    if (llmResponseValid && llmResult.response.likely_category !== "unclear") {
      category = llmResult.response.likely_category;
      confidence = llmResult.response.confidence;
      categorySource = "llm";
      // Cross-check with RAG
      if (ragBest && ragBest.category !== category) {
        // Disagreement. If RAG score is high and LLM confidence is low, prefer RAG.
        if (ragBest.score > 10 && confidence < 0.6) {
          category = ragBest.category;
          categorySource = "rag_override";
        }
      }
    } else if (ragBest && ragBest.score >= 8) {
      category = ragBest.category;
      confidence = Math.min(1, ragBest.score / 15);
      categorySource = "rag_fallback";
    } else {
      category = "unclear";
      categorySource = "none";
    }
    if (unsupportedEmergency) {
      category = "unclear";
      categorySource = "none";
      confidence = 0;
    }

    // 5. Select the protocol (deterministic)
    let protocol = null;
    let protocolId = null;
    if (category && category !== "unclear") {
      const selected = this.engine.getByCategory(category);
      protocol = selected
        ? this.engine.getRetrievable(selected.protocol_id, { includeDraft: this.includeDraft })
        : null;
      if (protocol) {
        protocolId = protocol.protocol_id;
      }
    }

    // 6. Get instructions (age-aware)
    let instructions = null;
    if (protocol) {
      instructions = this.engine.getInstructions(protocol.protocol_id, { ageGroup });
    }

    // 7. POST-CHECK safety: enforce escalation.
    // The LLM's escalation decision is OVERRIDDEN by the safety module's deterministic check.
    const escVerdict = this.safety.enforceEscalation(userText, llmResult?.response);
    const mustEscalate = Boolean(escVerdict.must_escalate || (llmResult?.ok && llmResult.response.requires_escalation));

    // Live references are non-urgent, read-only context; they never supply protocol steps.
    let referenceSearch = null;
    const referenceQuery = ctx.referenceQuery === undefined ? userText : ctx.referenceQuery;
    const isInformationRequest = /\?\s*$|^\s*(explain|define|meaning of|tell me about)\b/i.test(referenceQuery);
    const asksForImmediateAction = /\b(what should i do|what do i do|how (?:do|can|should) i|what can i do|can i give|should i give|how to treat|how can i stop|first aid|is this serious|should i worry)\b/i
      .test(referenceQuery);
    const intent = llmResponseValid ? llmResult.response.intent : "medical_or_emergency";
    if (!protocol && !mustEscalate && intent !== "general_nonmedical"
      && isInformationRequest && !asksForImmediateAction && this.referenceSearch) {
      referenceSearch = await this.referenceSearch.search(referenceQuery);
    }

    // 8. If life-threatening and LLM missed it, log a safety flag.
    if (escVerdict.llm_missed_escalation) {
      safetyFlags.push("LLM_MISSED_ESCALATION: deterministic safety net caught life-threatening signals the LLM did not flag");
    }

    // 9. Build the response
    const response = {
      ok: true,
      request_id: `docjr-${startedAt}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      latency_ms: Date.now() - startedAt,
      input: { text: userText, age_group: ageGroup },

      // Safety pre-check (deterministic, never bypassed)
      safety: {
        life_threatening_signals: lifeThreat,
        must_escalate: Boolean(mustEscalate),
        escalation_reason: escVerdict.must_escalate ? escVerdict.escalate_reason : null,
        escalation_message: mustEscalate ? this.safety.escalationMessage(escVerdict.escalate_reason) : null,
        flags: safetyFlags,
      },

      // Classification
      classification: {
        category,
        confidence,
        source: categorySource,
        intent,
        unsupported_category: unsupportedEmergency,
        llm_used: this.useLLM && llmResponseValid,
        llm_attempts: llmResult?.attempts || 0,
        llm_errors: llmResult?.errors || [],
        rag_score: ragBest?.score || 0,
        rag_candidates: ragResults.map(r => ({ protocol_id: r.protocol_id, category: r.category, score: r.score })),
      },
      reference_search: referenceSearch,

      // Extracted info
      extracted: llmResponseValid ? {
        symptoms: llmResult.response.extracted_symptoms,
        age_group: llmResult.response.extracted_age_group,
        clarification_questions: llmResult.response.clarification_questions,
        notes: llmResult.response.notes,
      } : null,

      // Selected protocol (the deterministic engine's choice)
      protocol: protocol ? {
        protocol_id: protocol.protocol_id,
        title: protocol.title,
        description: protocol.description,
        version: protocol.version,
        publication_status: protocol.publication_status,
        warning: protocol._warning || null,
        age_group_applied: instructions?.ageGroup || ageGroup,
        age_pathway: instructions?.agePathway || null,
        immediate_safety_warnings: protocol.immediate_safety_warnings,
        ordered_instructions: instructions?.instructions.map(s => ({
          step: s.step,
          instruction: s.instruction,
          rationale: s.rationale,
          must_not_skip: s.must_not_skip,
        })),
        actions_to_avoid: protocol.actions_to_avoid,
        approved_alternatives: protocol.approved_alternatives,
        equipment_requirements: protocol.equipment_requirements,
        follow_up_requirements: protocol.follow_up_requirements,
        source_references: protocol.source_references,
      } : null,

      // Nigeria emergency contacts (always present)
      emergency_contacts: mustEscalate ? NIGERIA_CONTACTS : null,

      // Raw LLM output (for debugging/audit)
      _raw_llm: llmResult?.raw || null,
    };

    return response;
  }

  // Sync stats
  stats() {
    return {
      engine: this.engine.stats(),
      retriever: this.retriever.stats(),
      safety_rules: this.safety.rules.length,
      use_llm: this.useLLM,
    };
  }
}

module.exports = { DocJr, NIGERIA_CONTACTS };

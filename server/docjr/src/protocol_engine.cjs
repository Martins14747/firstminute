// src/protocol_engine.cjs — Deterministic protocol engine.
// THE SAFETY-CRITICAL CORE. Owns the clinical instruction sequence.
// Loads only approved protocols; enforces escalation conditions; age pathways.

const fs = require("fs");
const path = require("path");

class ProtocolEngine {
  constructor(protocolsDir) {
    this.protocolsDir = protocolsDir || path.join(__dirname, "..", "protocols");
    this._cache = null;
  }

  load() {
    if (this._cache) return this._cache;
    const files = fs.readdirSync(this.protocolsDir).filter(f => f.endsWith(".json") && f !== "index.json");
    this._cache = {};
    for (const f of files) {
      const proto = JSON.parse(fs.readFileSync(path.join(this.protocolsDir, f), "utf8"));
      // Validate required fields
      this._validate(proto);
      this._cache[proto.protocol_id] = proto;
    }
    return this._cache;
  }

  _validate(p) {
    const required = ["protocol_id", "emergency_category", "title", "description",
      "applicable_age_groups", "recognition_questions", "observable_symptoms",
      "immediate_safety_warnings", "ordered_instructions", "actions_to_avoid",
      "escalation_conditions", "equipment_requirements", "approved_alternatives",
      "follow_up_requirements", "source_references", "reviewer", "version",
      "last_review_date", "publication_status"];
    for (const k of required) {
      if (p[k] === undefined || p[k] === null) {
        throw new Error(`Protocol ${p.protocol_id || "(no id)"} missing required field: ${k}`);
      }
    }
    if (!Array.isArray(p.source_references) || p.source_references.length === 0) {
      throw new Error(`Protocol ${p.protocol_id} has no source_references — engine refuses to load`);
    }
  }

  // Only approved protocols are surfaceable.
  listApproved() {
    const all = this.load();
    return Object.values(all).filter(p => p.publication_status === "approved");
  }

  listAll() {
    return Object.values(this.load());
  }

  get(protocolId) {
    const all = this.load();
    return all[protocolId] || null;
  }

  // For MVP testing: allow draft protocols to be used (with a flag).
  // In production, only "approved" should be retrievable.
  getRetrievable(protocolId, { includeDraft = false } = {}) {
    const p = this.get(protocolId);
    if (!p) return null;
    if (p.publication_status === "approved") return p;
    if (includeDraft && p.publication_status === "draft") {
      // Return a copy flagged draft, so callers know it's not approved.
      return { ...p, _warning: "DRAFT — pending clinical review" };
    }
    return null;
  }

  // Select protocol by category — deterministic mapping.
  // The LLM never selects; the engine does.
  getByCategory(category) {
    return this.listAll().find(p => p.emergency_category === category) || null;
  }

  // Get the ordered instructions for a protocol, applying age-specific pathway.
  getInstructions(protocolId, { ageGroup = "adult" } = {}) {
    const p = this.get(protocolId);
    if (!p) return null;
    if (!p.applicable_age_groups.includes(ageGroup)) {
      // Age group not directly applicable — fall back to adult if present, else first.
      const fallback = p.applicable_age_groups.includes("adult") ? "adult" : p.applicable_age_groups[0];
      return { protocol: p, ageGroup: fallback, _ageFallback: ageGroup, instructions: p.ordered_instructions, agePathway: p.age_specific_pathways?.[fallback] || null };
    }
    return { protocol: p, ageGroup, instructions: p.ordered_instructions, agePathway: p.age_specific_pathways?.[ageGroup] || null };
  }

  // Check escalation conditions against a set of observed facts.
  // Returns an array of triggered escalation actions.
  checkEscalation(protocolId, observedFacts = {}) {
    const p = this.get(protocolId);
    if (!p || !Array.isArray(p.escalation_conditions)) return [];
    const triggered = [];
    for (const cond of p.escalation_conditions) {
      if (this._matchesCondition(cond.condition, observedFacts)) {
        triggered.push({ condition: cond.condition, action: cond.action });
      }
    }
    return triggered;
  }

  _matchesCondition(conditionText, facts) {
    // Lightweight deterministic matching against known fact keys.
    const c = conditionText.toLowerCase();
    const matches = [];
    if (facts.unresponsive) matches.push(c.includes("unresponsive") || c.includes("unconscious") || c.includes("not breathing"));
    if (facts.not_breathing) matches.push(c.includes("not breathing") || c.includes("stops breathing") || c.includes("unconscious"));
    if (facts.heavy_bleeding) matches.push(c.includes("bleeding"));
    if (facts.seizure_over_5min) matches.push(c.includes("more than 5 minutes") || c.includes("status epilepticus"));
    if (facts.first_seizure) matches.push(c.includes("first") && c.includes("seizure"));
    if (facts.facial_swelling) matches.push(c.includes("swelling") && (c.includes("face") || c.includes("throat") || c.includes("tongue")));
    if (facts.difficulty_breathing) matches.push(c.includes("breathing") || c.includes("anaphylaxis") || c.includes("wheez"));
    if (facts.unconscious) matches.push(c.includes("unconscious") || c.includes("collapse"));
    if (facts.drowsy_confused) matches.push(c.includes("drowsy") || c.includes("confus"));
    if (facts.child_infant) matches.push(c.includes("child") || c.includes("infant") || c.includes("febrile"));
    return matches.some(m => m === true);
  }

  // Safety: actions that must NOT be done, for a protocol.
  getForbiddenActions(protocolId) {
    const p = this.get(protocolId);
    return p?.actions_to_avoid || [];
  }

  // Safety: approved alternatives only (closed list).
  getApprovedAlternatives(protocolId) {
    const p = this.get(protocolId);
    return p?.approved_alternatives || [];
  }

  // Safety: immediate warnings.
  getSafetyWarnings(protocolId) {
    const p = this.get(protocolId);
    return p?.immediate_safety_warnings || [];
  }

  // Stats for diagnostics.
  stats() {
    const all = this.listAll();
    return {
      total: all.length,
      approved: all.filter(p => p.publication_status === "approved").length,
      draft: all.filter(p => p.publication_status === "draft").length,
      categories: [...new Set(all.map(p => p.emergency_category))],
    };
  }
}

module.exports = { ProtocolEngine };

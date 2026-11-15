// src/retriever.cjs — RAG retrieval engine (hybrid keyword + TF-IDF-style scoring).
// No external vector DB; deterministic in-process retrieval suitable for offline mobile.
// Chunks are protocol fields (instructions, warnings, escalation, alternatives).

const fs = require("fs");
const path = require("path");

// Tokenize: lowercase, split on non-alphanumeric, remove very short tokens.
function tokenize(text) {
  if (!text) return [];
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(t => t.length > 1);
}

// Stopwords (English + a few Nigerian-English common words).
const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "to", "of", "in", "on", "at", "for", "with", "and", "or", "but", "not",
  "has", "have", "had", "do", "does", "did", "will", "would", "can", "could",
  "should", "may", "might", "must", "this", "that", "these", "those",
  "it", "its", "he", "she", "they", "them", "their", "there", "here",
  "what", "who", "when", "where", "why", "how", "which", "i", "you", "we",
  "me", "my", "your", "our", "us", "from", "as", "by", "if", "so", "no",
  "person", "people", "thing", "got", "get", "got", "now", "then", "just",
]);

function contentTokens(text) {
  return tokenize(text).filter(t => !STOPWORDS.has(t));
}

// Synonyms map — maps lay terms to protocol vocabulary.
const SYNONYMS = {
  // bleeding
  "cut": ["bleed", "wound", "laceration"],
  "blood": ["bleed", "bleeding"],
  "bleeding": ["bleed", "blood", "wound"],
  "deep": ["severe", "wound"],
  "stabbed": ["puncture", "wound"],
  // breathing
  "breath": ["breathing", "airway"],
  "breathe": ["breathing", "airway"],
  "choking": ["choke", "airway", "obstruction"],
  "can't": ["cannot"],
  // cardiac
  "collapsed": ["unresponsive", "unconscious", "cardiac"],
  "collapse": ["unresponsive", "unconscious"],
  "not responding": ["unresponsive", "unconscious"],
  "gasping": ["cpr", "cardiac", "breathing"],
  "heart": ["cardiac", "cpr"],
  // burns
  "burnt": ["burn", "burns"],
  "scald": ["burn", "scald", "burns"],
  "fire": ["burn", "burns"],
  "hot": ["burn", "scald"],
  "boiling": ["scald", "burn"],
  "oil": ["burn", "scald"],
  // head — only map to head when head/brain/concussion explicitly mentioned
  "bumped": ["head", "injury"],
  "bump": ["head", "injury"],
  "lump": ["head", "injury"],
  "concussion": ["head", "brain"],
  "skull": ["head", "fracture"],
  // poison
  "drank": ["swallow", "poison", "ingest"],
  "swallowed": ["ingest", "poison", "swallow", "poisoning"],
  "tablets": ["medicine", "poison", "ingest", "poisoning"],
  "pills": ["medicine", "poison", "ingest", "poisoning"],
  "poison": ["poisoning", "toxic"],
  "chemical": ["poison", "chemical"],
  "inhaled": ["inhale", "poison", "inhalation"],
  "spray": ["fumes", "inhalation", "poison"],
  "fumes": ["poison", "inhalation"],
  "generator": ["carbon", "monoxide", "poison"],
  "pesticide": ["poison", "toxic", "chemical", "poisoning", "ingest"],
  // bites
  "snake": ["bite", "snake", "venom", "poison"],
  "cobra": ["snake", "bite", "venom", "poison"],
  "scorpion": ["sting", "scorpion", "venom", "poison"],
  "stung": ["sting", "bite", "venom"],
  "bee": ["sting", "bite"],
  "spider": ["bite", "sting"],
  // fractures
  "broke": ["fracture", "broken", "bone"],
  "broken": ["fracture", "bone"],
  "fracture": ["broken", "bone"],
  "dislocated": ["dislocation", "joint"],
  "twisted": ["sprain", "fracture"],
  "sprain": ["fracture", "twisted"],
  "ankle": ["fracture", "sprain"],
  "wrist": ["fracture", "sprain"],
  "arm": ["fracture", "limb"],
  "leg": ["fracture", "limb"],
  "bent": ["fracture", "deformity"],
  "angle": ["fracture", "deformity"],
  "strange": ["fracture", "deformity"],
  "deformity": ["fracture", "deform"],
  "deformed": ["fracture", "deform"],
  // seizures
  "convulsion": ["seizure", "fit", "convulsing"],
  "convulsions": ["seizure", "fit", "convulsing"],
  "convulsing": ["seizure", "convulsion"],
  "fitting": ["seizure", "fit"],
  "epileptic": ["seizure", "epilepsy"],
  "jerking": ["seizure", "convulsion"],
  "stiffening": ["seizure", "convulsion"],
  "wheezy": ["wheezing", "allergy", "anaphylaxis"],
  // allergy
  "allergic": ["allergy", "anaphylaxis"],
  "hives": ["rash", "allergy", "urticaria"],
  "swelling": ["swollen", "oedema"],
  "swollen": ["swelling"],
  "peanut": ["allergy", "anaphylaxis"],
  "groundnut": ["allergy", "anaphylaxis"],
  "shellfish": ["allergy", "anaphylaxis"],
  "epipen": ["adrenaline", "anaphylaxis"],
  "adrenaline": ["epipen", "anaphylaxis"],
  "throat": ["airway", "anaphylaxis"],
  "closing": ["anaphylaxis", "airway"],
  "anaphylaxis": ["allergy", "adrenaline"],
  "anaphylactic": ["allergy", "adrenaline"],
};

// Disambiguation boosts — applied AFTER scoring, when a strong competing signal
// indicates a different category than the top RAG hit. These encode safety
// heuristics: e.g. "throat closing" almost always means anaphylaxis, not a bite.
const DISAMBIGUATION = [
  {
    name: "cardiac_arrest_over_competing_categories",
    triggers: ["not breathing", "only gasping"],
    boostCategory: "cpr_cardiac_arrest",
    penaliseCategory: "head_injuries_falls",
    boost: 18,
  },
  {
    name: "choking_over_allergy",
    triggers: ["food stuck in throat", "food stuck", "food blocking",
      "cannot make sounds after eating", "cannot talk after eating"],
    boostCategory: "choking",
    penaliseCategory: "severe_allergic_reactions",
    boost: 18,
  },
  {
    name: "burn_over_fracture",
    triggers: ["boiling water", "hot oil", "steam from", "scald", "burned", "burnt"],
    boostCategory: "burns_scalds",
    penaliseCategory: "fractures_dislocations",
    boost: 12,
  },
  {
    name: "snake_scorpion_bite_over_fracture",
    triggers: ["snake and was bitten", "bitten by a snake", "snake bite", "snake bit",
      "cobra", "scorpion"],
    boostCategory: "snake_scorpion_bites_stings",
    penaliseCategory: "fractures_dislocations",
    boost: 12,
  },
  {
    name: "anaphylaxis_over_bite",
    // If airway/allergy signals are present, boost allergy over bite/sting.
    triggers: ["throat closing", "throat swelling", "swollen face", "swollen tongue", "swollen lip",
              "swelling of the face", "swelling of the throat", "cannot breathe", "can't breathe",
              "lips are swelling", "lips swelling", "swelling lips", "tongue is swelling",
              "face is swollen", "hives and her face is swollen", "throat tightness",
              "wheezy", "anaphylaxis", "anaphylactic"],
    boostCategory: "severe_allergic_reactions",
    penaliseCategory: "snake_scorpion_bites_stings",
    boost: 15,
  },
  {
    name: "poisoning_terms",
    triggers: ["swallowed several tablets", "swallowed tablets", "swallowed pills",
      "tablets by mistake", "pesticide"],
    boostCategory: "poisoning",
    penaliseCategory: "fractures_dislocations",
    boost: 12,
  },
  {
    name: "seizure_terms",
    triggers: ["fitting", "convulsion", "convulsing", "epileptic seizure", "repeated seizures",
      "stiffening"],
    boostCategory: "seizures",
    penaliseCategory: "fractures_dislocations",
    boost: 12,
  },
  {
    name: "head_injury_terms",
    triggers: ["head injury", "hit her head", "hit his head", "bumped my head", "head and vomit"],
    boostCategory: "head_injuries_falls",
    penaliseCategory: "fractures_dislocations",
    boost: 12,
  },
  {
    name: "fracture_over_head",
    // If limb/deformity words present, boost fracture over head (a fall needn't be a head injury).
    triggers: ["arm", "leg", "ankle", "wrist", "bent", "angle", "deformity", "deformed",
              "strange angle", "twisted", "sprain", "fracture", "broken bone"],
    boostCategory: "fractures_dislocations",
    penaliseCategory: "head_injuries_falls",
    boost: 8,
  },
];

// Expand a query with synonyms.
function expandQuery(tokens) {
  const expanded = new Set(tokens);
  for (const t of tokens) {
    const syns = SYNONYMS[t];
    if (syns) syns.forEach(s => expanded.add(s));
    // Also check multi-word: handle bigrams from original text separately.
  }
  return [...expanded];
}

class Retriever {
  constructor(protocolsDir) {
    this.protocolsDir = protocolsDir || path.join(__dirname, "..", "protocols");
    this.chunks = [];
    this._built = false;
  }

  // Build retrievable chunks from all approved (or draft for MVP) protocols.
  // Each chunk = a protocol field, tagged with protocol_id + field.
  build() {
    if (this._built) return this.chunks;
    const files = fs.readdirSync(this.protocolsDir).filter(f => f.endsWith(".json") && f !== "index.json");
    this.chunks = [];
    for (const f of files) {
      const p = JSON.parse(fs.readFileSync(path.join(this.protocolsDir, f), "utf8"));
      const pid = p.protocol_id;
      // Title + description + category — high-weight identity chunk
      this.chunks.push({
        protocol_id: pid,
        category: p.emergency_category,
        field: "identity",
        text: `${p.title}. ${p.description}`,
        weight: 3.0,
      });
      // Symptoms
      this.chunks.push({
        protocol_id: pid,
        category: p.emergency_category,
        field: "symptoms",
        text: p.observable_symptoms.join(". "),
        weight: 2.5,
      });
      // Recognition questions
      this.chunks.push({
        protocol_id: pid,
        category: p.emergency_category,
        field: "recognition",
        text: p.recognition_questions.map(q => q.q).join(". "),
        weight: 2.0,
      });
      // Warnings
      this.chunks.push({
        protocol_id: pid,
        category: p.emergency_category,
        field: "warnings",
        text: p.immediate_safety_warnings.join(". "),
        weight: 1.5,
      });
      // Actions to avoid
      this.chunks.push({
        protocol_id: pid,
        category: p.emergency_category,
        field: "avoid",
        text: p.actions_to_avoid.join(". "),
        weight: 1.0,
      });
      // Escalation conditions
      this.chunks.push({
        protocol_id: pid,
        category: p.emergency_category,
        field: "escalation",
        text: p.escalation_conditions.map(e => e.condition).join(". "),
        weight: 1.5,
      });
    }
    // Pre-tokenize chunks
    for (const c of this.chunks) {
      c._tokens = new Set(contentTokens(c.text));
    }
    this._built = true;
    return this.chunks;
  }

  // Retrieve top-k protocols matching a query.
  // Returns [{ protocol_id, category, score, matched_chunks }] sorted desc.
  retrieve(query, k = 3) {
    this.build();
    const queryTokens = expandQuery(contentTokens(query));
    if (queryTokens.length === 0) return [];

    // Score each chunk
    const scored = this.chunks.map(c => {
      let score = 0;
      for (const qt of queryTokens) {
        if (c._tokens.has(qt)) score += 1;
        // Partial match bonus
        for (const ct of c._tokens) {
          if (ct.includes(qt) && ct !== qt) score += 0.3;
          if (qt.includes(ct) && ct !== qt) score += 0.3;
        }
      }
      return { chunk: c, rawScore: score };
    }).filter(s => s.rawScore > 0);

    // Aggregate by protocol_id
    const byProto = {};
    for (const s of scored) {
      const pid = s.chunk.protocol_id;
      if (!byProto[pid]) byProto[pid] = { protocol_id: pid, category: s.chunk.category, score: 0, matched_chunks: [] };
      byProto[pid].score += s.rawScore * s.chunk.weight;
      byProto[pid].matched_chunks.push({ field: s.chunk.field, text: s.chunk.text.slice(0, 200) });
    }

    // Apply disambiguation boosts to every result before returning, so all
    // callers (retrieveBest, orchestrator via retrieve(query, k)) get the
    // boosted ranking.
    const lower = query.toLowerCase();
    const boosted = Object.values(byProto).map(r => {
      let adj = r.score;
      for (const d of DISAMBIGUATION) {
        const triggered = d.triggers.some(t => lower.includes(t));
        if (triggered) {
          if (r.category === d.boostCategory) adj += d.boost;
          if (r.category === d.penaliseCategory) adj -= d.boost;
        }
      }
      return { ...r, score: adj, original_score: r.score };
    });
    return boosted.sort((a, b) => b.score - a.score).slice(0, k);
  }

  // Best single protocol match.
  retrieveBest(query) {
    const results = this.retrieve(query, 1);
    return results[0] || null;
  }

  stats() {
    this.build();
    return {
      chunk_count: this.chunks.length,
      protocols_indexed: new Set(this.chunks.map(c => c.protocol_id)).size,
    };
  }
}

module.exports = { Retriever, tokenize, contentTokens, expandQuery, SYNONYMS };

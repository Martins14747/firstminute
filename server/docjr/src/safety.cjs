// src/safety.cjs — Safety & escalation module.
// Enforces the 9 hard safety rules (code-enforced, not prompt guidance).
// Returns a verdict the orchestrator MUST honour.
//
// DESIGN PRINCIPLE: for a first-aid app, false negatives on escalation are
// far worse than false positives. We err toward escalating life-threatening
// cases. The deterministic safety net catches what the LLM might miss.

// The 9 hard rules from the spec (Section 12.1).
const HARD_RULES = [
  { id: 1, name: "never_rule_out_serious_injury",
    description: "Never use image analysis to rule out a serious injury." },
  { id: 2, name: "never_delay_emergency_services_for_image",
    description: "Never delay emergency services while analysing an image." },
  { id: 3, name: "never_invent_dosages",
    description: "Never invent medication dosages." },
  { id: 4, name: "never_unapproved_alternatives",
    description: "Never provide unapproved treatment alternatives." },
  { id: 5, name: "never_predictions_as_diagnosis",
    description: "Never present uncertain AI predictions as diagnoses." },
  { id: 6, name: "always_escalate_life_threatening",
    description: "Always escalate potentially life-threatening emergencies." },
  { id: 7, name: "clear_instructions_when_unclear",
    description: "Always give clear instructions when an image cannot be interpreted." },
  { id: 8, name: "preserve_human_oversight",
    description: "Preserve human medical oversight." },
  { id: 9, name: "traceable_sources",
    description: "Maintain a traceable source for every clinical protocol." },
];

// Life-threatening signal PATTERNS. Each entry: { pat: regex|string, label: string }.
// Patterns are matched case-insensitively against the user text.
// These are deliberately broad: any reasonable indication of a life-threatening
// emergency should trigger escalation. The cost of a missed escalation is a death.
const LIFE_THREATENING_PATTERNS = [
  // Breathing / airway
  { pat: /\bnot breathing\b/, label: "not breathing" },
  { pat: /\bisn't breathing\b/, label: "isn't breathing" },
  { pat: /\baren't breathing\b/, label: "aren't breathing" },
  { pat: /\bno breathing\b/, label: "no breathing" },
  { pat: /\bstopped breathing\b/, label: "stopped breathing" },
  { pat: /\bcan(?:no|')t breathe\b/, label: "cannot breathe" },
  { pat: /\bcannot breathe\b/, label: "cannot breathe" },
  { pat: /\bcannot speak\b/, label: "cannot speak" },
  { pat: /\bcan't speak\b/, label: "can't speak" },
  { pat: /\bstruggling to breathe\b/, label: "struggling to breathe" },
  { pat: /\bdifficulty breathing\b/, label: "difficulty breathing" },
  { pat: /\btrouble breathing\b/, label: "trouble breathing" },
  { pat: /\bthroat (is )?closing\b/, label: "throat closing" },
  { pat: /\bthroat swell\b/, label: "throat swelling" },
  { pat: /\bthroat tightness\b/, label: "throat tightness" },
  { pat: /\bairway (blocked|obstruct)/, label: "airway obstruction" },
  { pat: /\bblocked\b.*\bairway\b/, label: "airway obstruction" },
  { pat: /\bgasping\b/, label: "gasping" },
  { pat: /\bwheezing\b/, label: "wheezing" },
  { pat: /\bwheezy\b/, label: "wheezing" },
  { pat: /\bclutching (?:his|her|their) neck\b/, label: "possible choking" },
  { pat: /\bcannot make sounds\b/, label: "unable to speak" },
  { pat: /\bcannot talk\b/, label: "unable to speak" },
  // Consciousness
  { pat: /\bunconscious\b/, label: "unconscious" },
  { pat: /\bunresponsive\b/, label: "unresponsive" },
  { pat: /\bnot responding\b/, label: "not responding" },
  { pat: /\bnot responsive\b/, label: "not responsive" },
  { pat: /\bpassed out\b/, label: "passed out" },
  { pat: /\bcollapse[ds]?\b/, label: "collapsed" },
  { pat: /\bknocked out\b/, label: "knocked out" },
  { pat: /\bnot waking up\b/, label: "not waking up" },
  { pat: /\bwon't wake\b/, label: "won't wake" },
  // Cyanosis / shock
  { pat: /\bblue (lips|face|fingers|skin)\b/, label: "cyanosis" },
  { pat: /\bturning blue\b/, label: "cyanosis" },
  { pat: /\bcyanos/, label: "cyanosis" },
  { pat: /\bpale and (cold|clammy)\b/, label: "shock signs" },
  { pat: /\bclammy\b.*\bpale\b/, label: "shock signs" },
  { pat: /\bgrey (face|skin)\b/, label: "grey face" },
  // Bleeding
  { pat: /\bsevere bleed/, label: "severe bleeding" },
  { pat: /\bheavy bleed/, label: "heavy bleeding" },
  { pat: /\bbleeding\b.{0,20}\b(heavily|badly|won't stop|will not stop|cannot stop)\b/, label: "heavy bleeding" },
  { pat: /\bbleeding\b.{0,30}\b(stop|stopped)\b/, label: "uncontrolled bleeding" },
  { pat: /\bbleeding heavily\b/, label: "heavy bleeding" },
  { pat: /\bbleeding badly\b/, label: "heavy bleeding" },
  { pat: /\bblood (is )?pouring\b/, label: "heavy bleeding" },
  { pat: /\bblood (is )?spurting\b/, label: "arterial bleeding" },
  { pat: /\bspurting blood\b/, label: "arterial bleeding" },
  { pat: /\bdeep cut\b/, label: "deep wound" },
  { pat: /\bsoaking\b.*\bblood/, label: "heavy bleeding" },
  { pat: /\bblood\b.{0,30}\b(soaking|soaked)\b/, label: "heavy bleeding" },
  { pat: /\b(soaking|soaked)\b.{0,30}\bblood\b/, label: "heavy bleeding" },
  { pat: /\bmajor bleed/, label: "major bleeding" },
  { pat: /\bbleeding out\b/, label: "bleeding out" },
  { pat: /\bdeep wound\b/, label: "deep wound" },
  // Allergy / anaphylaxis
  { pat: /\bswell(?:s|ed|ing|en)?\b.*\b(face|lips?|tongue|throat)\b/, label: "facial swelling" },
  { pat: /\b(face|lips?|tongue|throat)\b.*\bswell(?:s|ed|ing|en)?\b/, label: "facial swelling" },
  { pat: /\bswollen (face|lips?|tongue|throat)\b/, label: "facial swelling" },
  { pat: /\b(face|lips?|tongue|throat)\b.{0,20}\b(swollen|swelling|swells|swelled)\b/, label: "facial swelling" },
  { pat: /\b(swollen|swelling|swells|swelled)\b.{0,20}\b(face|lips?|tongue|throat)\b/, label: "facial swelling" },
  { pat: /\banaphyla/, label: "anaphylaxis" },
  { pat: /\bthroat closing\b/, label: "anaphylaxis" },
  // Seizure
  { pat: /\bseizures?\b/, label: "seizure" },
  { pat: /\bconvulsion/, label: "seizure" },
  { pat: /\bconvulsing\b/, label: "seizure" },
  { pat: /\bjerking uncontrollably\b/, label: "seizure" },
  { pat: /\bbody is jerking\b/, label: "seizure" },
  { pat: /\bfitting\b/, label: "seizure" },
  { pat: /\bstatus epilepticus\b/, label: "status epilepticus" },
  // Poisoning severe
  { pat: /\bdrank.*chemical\b/, label: "chemical ingestion" },
  { pat: /\bswallowed.*chemical\b/, label: "chemical ingestion" },
  { pat: /\bdrank.*poison\b/, label: "poison ingestion" },
  { pat: /\bswallow(?:ed)?\b.*\b(pesticide|chemical|tablets?|pills?|medicine|poison)\b/, label: "possible poisoning" },
  { pat: /\b(inhaled|breathed in)\b.*\b(pesticide|chemical|spray|fumes)\b/, label: "possible poisoning" },
  { pat: /\bgenerator fumes\b/, label: "carbon monoxide" },
  { pat: /\bcarbon monoxide\b/, label: "carbon monoxide" },
  { pat: /\bfumes\b.*\bunconsc/, label: "carbon monoxide" },
  // Burns severe
  { pat: /\bsevere burn\b/, label: "severe burn" },
  { pat: /\belectrical burn\b/, label: "electrical burn" },
  { pat: /\bchemical burn\b/, label: "chemical burn" },
  { pat: /\bburn.*(face|hands|genitals)\b/, label: "burn to critical area" },
  { pat: /\bhot oil\b.*\bface\b/, label: "burn to face" },
  { pat: /\bhot (oil|water|tea|liquid)\b.*\bface\b/, label: "burn to face" },
  // Bites/stings severe
  { pat: /\b(snake|cobra)\b.{0,30}\b(bit|bite|bitten)\b/i, label: "snakebite" },
  { pat: /\b(bit|bite|bitten)\b.{0,30}\b(snake|cobra)\b/i, label: "snakebite" },
  { pat: /\bsnakebite\b/, label: "snakebite" },
  { pat: /\bscorpion\b.{0,30}\b(stung|sting)\b/i, label: "scorpion sting" },
  { pat: /\b(stung|sting)\b.{0,30}\bscorpion\b/i, label: "scorpion sting" },
  { pat: /\bscorpion\b.*\bbab(y|ies)\b/, label: "scorpion sting infant" },
  // Choking
  { pat: /\bchoking\b/, label: "choking" },
  { pat: /\bchok(e|ing)\b/, label: "choking" },
  // Head injury severe
  { pat: /\bhit.*head.*vomit/, label: "head injury with vomiting" },
  { pat: /\bhead.*vomit/, label: "head injury with vomiting" },
  { pat: /\bhead\b.{0,30}\b(confused|confusion|drowsy|sleepy)\b/, label: "head injury with altered awareness" },
  { pat: /\bvomit.*head/, label: "head injury with vomiting" },
  { pat: /\bknocked out.*head/, label: "head injury with unconsciousness" },
  { pat: /\bloss of consciousness\b/, label: "loss of consciousness" },
  { pat: /\bpassed out.*\bhead\b/, label: "head injury" },
  { pat: /\bclear fluid.*ear\b/, label: "skull fracture sign" },
  // Cardiac
  { pat: /\b(chest pain|chest pressure|pain in (?:the )?chest)\b/, label: "chest pain" },
  { pat: /\bcardiac arrest\b/, label: "cardiac arrest" },
  { pat: /\bheart (stopped|attack)\b/, label: "cardiac event" },
  // Emergencies present in the FirstMinute app but not yet covered by a Doc. Jr protocol
  { pat: /\bstroke\b/, label: "possible stroke" },
  { pat: /\bface droop(ing)?\b/, label: "possible stroke" },
  { pat: /\bslurred speech\b/, label: "possible stroke" },
  { pat: /\bweak arm\b/, label: "possible stroke" },
  { pat: /\bone[- ]sided weakness\b/, label: "possible stroke" },
  { pat: /\bheat\s*stroke\b/, label: "heat stroke" },
  // Drowning
  { pat: /\bdrowning\b/, label: "drowning" },
  // Infant + emergency
  { pat: /\bbab(y|ies)\b.*\b(seizure|convulsion|choking|not breathing|blue)\b/, label: "infant emergency" },
  { pat: /\binfant\b.*\b(seizure|convulsion|choking|not breathing|blue)\b/, label: "infant emergency" },
];

// Forbidden recommendations — if the LLM output contains any of these,
// the safety layer rejects and falls back.
const FORBIDDEN_RECOMMENDATIONS = [
  "induce vomiting", "make them vomit",
  "give activated charcoal",
  "insert fingers into", "blind finger sweep",
  "put a spoon", "put something in their mouth",
  "cut the wound", "suck out the venom", "suck the venom",
  "give a medication", "give them medicine", "give the person medication",
  "it's fine", "is fine", "not serious", "nothing to worry",
  "diagnosed", "diagnosis is", "the diagnosis",
];

class SafetyModule {
  constructor() {
    this.rules = HARD_RULES;
  }

  // Detect life-threatening signals in user text via the pattern list.
  detectLifeThreatening(text) {
    const t = (text || "").toLowerCase();
    const matched = [];
    for (const { pat, label } of LIFE_THREATENING_PATTERNS) {
      if (pat.test(t)) matched.push(label);
    }
    // de-duplicate
    return [...new Set(matched)];
  }

  isLifeThreatening(text) {
    return this.detectLifeThreatening(text).length > 0;
  }

  // Validate an LLM-generated response against the forbidden list.
  // Returns { valid: bool, violations: string[] }.
  validateResponse(llmOutput) {
    const text = JSON.stringify(llmOutput || "").toLowerCase();
    const violations = FORBIDDEN_RECOMMENDATIONS.filter(f => text.includes(f));
    return { valid: violations.length === 0, violations };
  }

  // Decide whether to override the LLM's escalation decision.
  // If the user text is life-threatening, escalation is MANDATORY regardless of LLM.
  enforceEscalation(userText, llmResponse) {
    const signals = this.detectLifeThreatening(userText);
    const mustEscalate = signals.length > 0;
    const llmSaysEscalate = llmResponse && llmResponse.requires_escalation === true;
    return {
      must_escalate: mustEscalate,
      escalate_reason: mustEscalate ? `Life-threatening signals: ${signals.join(", ")}` : null,
      llm_agrees: mustEscalate ? llmSaysEscalate : null,
      llm_missed_escalation: mustEscalate && !llmSaysEscalate,
    };
  }

  // Build the escalation instruction shown to the user.
  escalationMessage(reason) {
    return `🚨 CALL 112 NOW — this may be life-threatening. ${reason ? "(" + reason + ")" : ""} Then continue with first aid.`;
  }

  // Get the rules list (for documentation / model card).
  getRules() {
    return this.rules;
  }
}

module.exports = { SafetyModule, HARD_RULES, LIFE_THREATENING_PATTERNS, FORBIDDEN_RECOMMENDATIONS };

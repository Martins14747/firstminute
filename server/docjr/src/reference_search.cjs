// Trusted, reference-only lookup against MedlinePlus (U.S. National Library of Medicine).

const { createHash } = require("node:crypto");

const SEARCH_URL = "https://wsearch.nlm.nih.gov/ws/query";
const TRUSTED_ORIGIN = "https://medlineplus.gov";
const REQUEST_TIMEOUT_MS = 8000;
const MAX_RESULTS = 3;
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
const MAX_REQUESTS_PER_MINUTE = 70;
const SEARCH_STOPWORDS = new Set([
  "a", "an", "and", "are", "at", "about", "can", "could", "do", "does", "find", "for",
  "how", "i", "information", "is", "it", "look", "me", "of", "on", "or", "please",
  "search", "source", "sources", "tell", "the", "this", "to", "was", "what",
  "when", "where", "which", "who", "why", "you",
]);

function decodeXml(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#([0-9]+);/g, (_, code) => String.fromCodePoint(parseInt(code, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function getAttribute(tag, name) {
  const match = tag.match(new RegExp(`(?:^|\\s)${name}=(["'])(.*?)\\1`));
  return match ? decodeXml(match[2]) : "";
}

function getContent(documentXml, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = documentXml.match(new RegExp(
    `<content\\b(?=[^>]*\\bname=["']${escapedName}["'])[^>]*>([\\s\\S]*?)<\\/content>`,
    "i",
  ));
  return match ? decodeXml(match[1]).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : "";
}

function safeSourceUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.origin !== TRUSTED_ORIGIN) return null;
    return url.href;
  } catch {
    return null;
  }
}

function parseResults(xml, limit = MAX_RESULTS) {
  const results = [];
  const documents = String(xml || "").matchAll(/<document\b([^>]*)>([\s\S]*?)<\/document>/gi);
  for (const match of documents) {
    const url = safeSourceUrl(getAttribute(match[1], "url"));
    const title = getContent(match[2], "title") || decodeXml(getAttribute(match[1], "title"));
    if (!url || !title) continue;

    const summary = getContent(match[2], "snippet").slice(0, 240);
    results.push({
      source: "MedlinePlus — U.S. National Library of Medicine",
      title: title.slice(0, 160),
      summary,
      url,
    });
    if (results.length >= limit) break;
  }
  return results;
}

function sanitizeQuery(text) {
  const cleaned = String(text || "")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, " ")
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, " ")
    .replace(/\+?\d[\d\s().-]{6,}\d/g, " ")
    .replace(/\b(?:my name is|i am called|i'm called|name is)\s+[a-z'-]+/gi, " ")
    .replace(/[^a-z0-9\s'-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.split(/\s+/)
    .filter(term => term && !SEARCH_STOPWORDS.has(term.toLowerCase()))
    .slice(0, 12)
    .join(" ")
    .slice(0, 240);
}

class MedlinePlusReferenceSearch {
  constructor({ fetchImpl = globalThis.fetch, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.cache = new Map();
    this.inFlight = new Map();
    this.requestTimes = [];
  }

  async search(text) {
    const query = sanitizeQuery(text);
    if (!query) return { status: "no_query", results: [] };

    const key = createHash("sha256").update(query.toLowerCase()).digest("hex");
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    if (cached) this.cache.delete(key);
    if (this.inFlight.has(key)) return this.inFlight.get(key);

    const now = Date.now();
    this.requestTimes = this.requestTimes.filter(time => now - time < 60_000);
    if (this.requestTimes.length >= MAX_REQUESTS_PER_MINUTE) {
      return { status: "unavailable", results: [], error: "MedlinePlus request rate limit reached" };
    }
    this.requestTimes.push(now);

    const pending = this.fetchResults(query, key);
    this.inFlight.set(key, pending);
    try {
      return await pending;
    } finally {
      this.inFlight.delete(key);
    }
  }

  async fetchResults(query, key) {
    const url = new URL(SEARCH_URL);
    url.searchParams.set("db", "healthTopics");
    url.searchParams.set("term", query);
    url.searchParams.set("retmax", String(MAX_RESULTS));
    url.searchParams.set("tool", "firstminute");

    try {
      const response = await this.fetchImpl(url, {
        headers: { accept: "application/xml, text/xml" },
        redirect: "error",
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!response.ok) return { status: "unavailable", results: [], error: `HTTP ${response.status}` };
      const results = parseResults(await response.text());
      const value = { status: results.length ? "found" : "no_results", results };
      this.cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
      while (this.cache.size > MAX_CACHE_ENTRIES) {
        this.cache.delete(this.cache.keys().next().value);
      }
      return value;
    } catch (error) {
      return { status: "unavailable", results: [], error: String(error.message || error).slice(0, 120) };
    }
  }
}

module.exports = {
  MedlinePlusReferenceSearch,
  parseResults,
  sanitizeQuery,
  safeSourceUrl,
};

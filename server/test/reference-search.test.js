import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  MedlinePlusReferenceSearch,
  parseResults,
  sanitizeQuery,
} = require('../docjr/src/reference_search.cjs');

test('trusted reference parser keeps only MedlinePlus links and extracts short snippets', () => {
  const xml = `
    <nlmSearchResult><list>
      <document url="https://medlineplus.gov/heatstroke.html">
        <content name="title">Heat Stroke</content>
        <content name="snippet">Heat stroke &amp; heat illness.</content>
      </document>
      <document url="https://medlineplus.gov.attacker.example/fake">
        <content name="title">Fake</content>
        <content name="snippet">Not trusted</content>
      </document>
      <document url="http://medlineplus.gov/unsafe">
        <content name="title">Insecure</content>
      </document>
    </list></nlmSearchResult>`;

  assert.deepEqual(parseResults(xml), [{
    source: 'MedlinePlus — U.S. National Library of Medicine',
    title: 'Heat Stroke',
    summary: 'Heat stroke & heat illness.',
    url: 'https://medlineplus.gov/heatstroke.html',
  }]);
});

test('search sends a bounded sanitized query and returns references only', async () => {
  let requested;
  const search = new MedlinePlusReferenceSearch({
    fetchImpl: async (url, options) => {
      requested = { url: String(url), options };
      return {
        ok: true,
        text: async () => '<document url="https://medlineplus.gov/eczema.html"><content name="title">Eczema</content></document>',
      };
    },
  });

  const result = await search.search('What is eczema? My name is Alex. Call me at 555-123-4567');
  const url = new URL(requested.url);
  assert.equal(url.origin, 'https://wsearch.nlm.nih.gov');
  assert.equal(url.searchParams.get('db'), 'healthTopics');
  assert.equal(url.searchParams.get('term'), 'What is eczema Call me at');
  assert.equal(url.searchParams.get('retmax'), '3');
  assert.equal(requested.options.redirect, 'error');
  assert.equal(result.status, 'found');
  assert.equal(result.results[0].title, 'Eczema');
  assert.equal(result.results[0].url, 'https://medlineplus.gov/eczema.html');
});

test('lookup reports network failures and strips common personal identifiers', async () => {
  const search = new MedlinePlusReferenceSearch({
    fetchImpl: async () => { throw new Error('network unavailable'); },
  });

  assert.equal(sanitizeQuery('My name is Alex, email a@example.com, phone 555-123-4567'), 'email phone');
  assert.deepEqual(await search.search('What is eczema?'), {
    status: 'unavailable',
    results: [],
    error: 'network unavailable',
  });
});

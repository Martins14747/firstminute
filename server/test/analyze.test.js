import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isVisionConfigurationError } from '../routes/analyze.js';

test('vision configuration errors are identified without exposing provider details', () => {
  assert.equal(isVisionConfigurationError(new Error('Configuration file not found or invalid.')), true);
  assert.equal(isVisionConfigurationError('ZAI_BASE_URL and ZAI_API_KEY must both be set'), true);
  assert.equal(isVisionConfigurationError(new Error('upstream request timed out')), false);
});

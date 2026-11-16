import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeJob, countriesFor, parseSources, collectEmployers, searchEmployers } from '../employer-index.js';
import worker from '../worker.js';

const source = { type: 'greenhouse', board: 'sample', company: 'Sample', industry: 'IT and software' };
const raw = { id: 1, title: 'Head of Technical Support', absolute_url: 'https://example.com/jobs/1', content: '&lt;p&gt;Cloud &amp; AI&lt;/p&gt;', location: { name: 'London, United Kingdom' }, updated_at: '2026-11-16' };
const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-only', EMPLOYER_SOURCES: JSON.stringify([source]) };
test('employer classification stays separate from occupation; unknown posted dates remain unknown', () => {
  const job = normalizeJob(raw, source);
  assert.equal(job.level, 'Manager');assert.equal(job.description, 'Cloud & AI');
  assert.equal(job.posted_at, null);assert.equal(job.arrangement, 'Unknown');
  assert.deepEqual(job.countries, ['gb']);
  assert.equal(normalizeJob(raw, { ...source, industry: 'Finance' }).industry, 'Finance');
  assert.deepEqual(countriesFor('Remote'), []);
  assert.deepEqual(countriesFor('United States'), ['us']);
  assert.deepEqual(countriesFor('London, Ontario, Canada'), []);
  assert.deepEqual(countriesFor('Reading, PA'), ['us']);
});
test('Lever includes requirements lists and supports explicit workplace type', () => {
  const job = normalizeJob({ id: 'a', text: 'Director of Support', hostedUrl: 'https://example.com/a', categories: { location: 'Boston, United States' }, workplaceType: 'remote', descriptionPlain: 'Lead support.', lists: [{ text: 'Requirements', content: '<li>Cloud experience</li>' }] }, { ...source, type: 'lever' });
  assert.equal(job.arrangement, 'Remote');assert.equal(job.level, 'Director');assert.match(job.description, /Cloud experience/);
});
test('sources cannot inject arbitrary hosts or duplicate boards', () => {
  assert.throws(() => parseSources(JSON.stringify([{ ...source, board: '../private' }])));
  assert.throws(() => parseSources(JSON.stringify([source, source])));
});
test('failed, empty and malformed feeds never trigger a database sync', async () => {
  const original = globalThis.fetch;
  try {
    for (const response of [new Response('{}', { status: 503 }), Response.json({ jobs: [] }), Response.json({ jobs: [{ id: 1 }] })]) {
      let calls = 0;globalThis.fetch = async () => { calls++;return response; };
      const results = await collectEmployers(env);
      assert.equal(calls, 1);assert.equal(results[0].ok, false);
    }
  } finally { globalThis.fetch = original; }
});
test('successful board is synced once with its complete records', async () => {
  const original = globalThis.fetch;const calls = [];
  try {
    globalThis.fetch = async (url, init) => { calls.push({ url, init });return calls.length === 1 ? Response.json({ jobs: [raw], meta: { total: 1 } }) : Response.json({ imported: 1 }); };
    const results = await collectEmployers(env);
    assert.equal(results[0].imported, 1);assert.equal(calls.length, 2);
    assert.equal(JSON.parse(calls[1].init.body).p_jobs.length, 1);
    assert.equal(calls[1].init.headers.Authorization, 'Bearer test-only');
  } finally { globalThis.fetch = original; }
});
test('filters and pagination are sent to the database; browser receives no secret', async () => {
  const original = globalThis.fetch;let payload;
  try {
    globalThis.fetch = async (url, init) => { payload = JSON.parse(init.body);return Response.json({ count: 81, results: [normalizeJob(raw, source)], last_synced: null }); };
    const result = await searchEmployers(new URL('https://example.com/api/index/jobs?what=support&where=United%20Kingdom&levels=Manager,Director&industries=IT%20and%20software&page=2'), env);
    assert.equal(payload.p_page, 2);assert.equal(payload.p_page_size, 50);assert.equal(payload.p_location, '');
    assert.deepEqual(payload.p_levels, ['Manager', 'Director']);
    assert.equal(result.count, 81);assert.equal(result.results[0].company.display_name, 'Sample');
    assert.ok(!JSON.stringify(result).includes('test-only'));
  } finally { globalThis.fetch = original; }
});
test('unconfigured employer route returns useful error and existing API health stays available', async () => {
  const response = await worker.fetch(new Request('https://example.com/api/index/jobs'), {});
  assert.equal(response.status, 503);assert.match((await response.json()).error, /Choose Adzuna/);
  assert.equal((await worker.fetch(new Request('https://example.com/health'), {})).status, 200);
});

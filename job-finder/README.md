# Employer job index

This adds a Jorb-style collection and database-search path alongside the existing Adzuna search. It uses your own Supabase database, never Jorb's data or credentials.

## What changes

- A Cloudflare scheduled handler collects full public Greenhouse and Lever boards twice daily (06:15 and 18:15 UTC).
- Three live-verified Greenhouse boards are configured initially: GitLab, Anthropic and Databricks. More boards can be added through `EMPLOYER_SOURCES`.
- Employer records are upserted by provider, board and job ID. A complete successful collection closes jobs missing from that board. Failed, empty or malformed feeds retain existing records; records not seen for three days disappear from search.
- The database applies title-keyword, country, location, level, employer industry, arrangement and date filters before counting and returning 50 records per page. Title search uses PostgreSQL word stemming and quoted phrases; full descriptions are retained for personal fit scoring. A generic mention of “support” in an unrelated advert does not make it a title match.
- The website offers **Adzuna** and **Direct employer feeds**. Adzuna remains the default and retains its current behaviour. Existing personal-priority scoring remains available; AI scores at most 20 adverts per page, explicitly disclosed in the result message.
- No Supabase credentials are sent to the browser. RLS and grants restrict the table and RPCs to the Worker service role.

## Activation

1. Create or choose a Supabase project and run `supabase.sql` in its SQL editor.
2. In the existing `job-finder-api` Cloudflare Worker, add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as secrets. Never paste the service-role key into HTML or commit it.
3. From this directory deploy the **module bundle**, not a single pasted worker file: `npx wrangler deploy`. `worker.js` now imports `employer-index.js`. Inspect `wrangler.jsonc` first and retain the existing Adzuna secrets, any account-specific settings, and the AI binding. Confirm plan limits and usage before activating collection.
4. Run an initial scheduled event locally against the remote services, or wait for the next scheduled collection. A local initial run uses `npx wrangler dev --test-scheduled` with the secrets in ignored `.dev.vars`, then a local request to `http://localhost:8787/__scheduled?cron=15+6,18+*+*+*`. This calls the configured remote Supabase project. It does not expose a public collection endpoint.
5. Deploy `index.html` through the existing GitHub Pages process. Choose **Direct employer feeds**, search for `support`, country UK, then test Manager/Director filters and pagination.

Database setup and a successful initial collection are prerequisites for useful employer results. Deploying the website alone does not activate this backend.

## Add employer boards

`EMPLOYER_SOURCES` is a JSON array (maximum 20 boards per Worker):

```json
[
  {"type":"greenhouse","board":"gitlab","company":"GitLab","industry":"IT and software"},
  {"type":"lever","board":"YOUR_VERIFIED_BOARD","company":"Your employer","industry":"Finance","region":"eu"}
]
```

Omit `region` for global Lever boards. Supply industry from the employer's business, rather than the job's technical function. `startup: true` is optional. Removing a board stops refreshing it; its jobs expire from search after three days.

## Coverage and limits

- These are configured employer boards, not a search across all employers or all ATS platforms. Workday, Oracle, LinkedIn and other collectors are not implemented.
- Country recognition is deliberately limited to known UK/US country and city labels. Vague `Remote`, EMEA, other countries and unrecognised locations are excluded by country filters. Location is a literal text match; radius/postcode geocoding is not implemented, and the distance control is disabled for employer search.
- Seniority is inferred from titles. Arrangement uses explicit workplace/location labels; unknowns stay unknown. Industry is configured per employer. These classifications need ongoing review.
- Original posting dates are used where supplied. Update and collection dates are never substituted for unknown posting dates. Date filters exclude undated records.
- Duplicate IDs on one board are upserted; identical adverts on different boards are not consolidated. A future canonical-URL/requisition mapping can add that safely.
- This scheduled Worker is a small initial collector. Review CPU, payload, database and AI limits before expanding boards; large-scale collection should use a queue or separate runner.
- Respect employer/API usage terms and keep links back to the original adverts.

## Verification

Run `npm ci` then `npm test`. Tests exercise collection failures, normalization, Worker responses and real PostgreSQL schema/functions through PGlite, including filters before pagination, transaction rollback, stale records and role permissions.

Primary API references: [Greenhouse Job Board API](https://docs.greenhouse.io/job-board) and [Lever Postings API](https://github.com/lever/postings-api).

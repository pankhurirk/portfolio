import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('real PostgreSQL: filtering, pagination, retirement, rollback and access controls', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
    await db.exec(await readFile(new URL('../supabase.sql', import.meta.url), 'utf8'));
    const base = { source_id: 'greenhouse:test', source: 'Greenhouse', company: 'Test', title: 'Director of Technical Support', location: 'London, United Kingdom', countries: ['gb'], description: 'Cloud platform support', url: 'https://example.com/job', level: 'Director', industry: 'IT and software', arrangement: 'Hybrid', startup: false, posted_at: new Date().toISOString() };
    const jobs = Array.from({ length: 65 }, (_, i) => ({ ...base, id: 'job:' + String(i).padStart(3,'0') }));
    await db.query('select public.sync_employer_jobs($1,$2::jsonb)', [base.source_id, JSON.stringify(jobs)]);
    const search = async (query='',country='gb',location='',levels=[],industries=[],arrangements=[],days=null,page=1) => (await db.query('select public.search_employer_jobs($1,$2,$3,$4::text[],$5::text[],$6::text[],$7,$8,50) as result', [query,country,location,levels,industries,arrangements,days,page])).rows[0].result;
    const first = await search('support','gb','London',['Director'],['IT and software'],['Hybrid'],7);
    assert.equal(first.count,65);assert.equal(first.results.length,50);
    assert.equal((await search('support','gb','London',[],[],[],null,2)).results.length,15);
    assert.equal((await search('support','us')).count,0);
    assert.equal((await search('support','gb','',['Manager'])).count,0);
    assert.equal((await search('support','gb','',[],['Finance'])).count,0);
    assert.equal((await search('support','gb','',[],[],['Remote'])).count,0);
    assert.equal((await search('support','gb','%')).count,0); // location wildcards remain literal
    assert.equal((await search('platform')).count,0); // description-only words do not match job titles
    await db.query('select public.sync_employer_jobs($1,$2::jsonb)', [base.source_id,JSON.stringify(jobs.slice(0,2))]);
    assert.equal((await search()).count,2);
    assert.equal((await db.query('select count(*)::int n from public.employer_jobs where not active')).rows[0].n,63);
    await assert.rejects(db.query('select public.sync_employer_jobs($1,$2::jsonb)',[base.source_id,JSON.stringify([{ ...jobs[0], source_id:'wrong' }]) ]));
    assert.equal((await search()).count,2);
    await db.exec("update public.employer_jobs set posted_at=null where id='job:000';");
    assert.equal((await search('','gb','',[],[],[],1)).count,1);
    await db.exec("update public.employer_jobs set last_seen=now()-interval '4 days' where id='job:001';");
    assert.equal((await search()).count,1);
    await db.exec('set role anon;');
    await assert.rejects(db.query('select * from public.employer_jobs'));
    await assert.rejects(db.query('select public.search_employer_jobs()'));
    await db.exec('reset role; set role service_role;');
    assert.equal((await search()).count,1);
  } finally { await db.close(); }
});

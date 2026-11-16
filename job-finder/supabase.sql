-- Run once in your own Supabase project's SQL editor. No browser access to tables.
create table if not exists public.employer_jobs (
  id text primary key, source_id text not null, source text not null,
  company text not null, title text not null, location text not null default '',
  countries text[] not null default '{}', description text not null default '',
  url text not null, level text not null, industry text not null, arrangement text not null,
  startup boolean not null default false, posted_at timestamptz,
  first_seen timestamptz not null default now(), last_seen timestamptz not null default now(),
  active boolean not null default true,
  search_document tsvector generated always as (to_tsvector('english', title)) stored
);
create index if not exists employer_jobs_search on public.employer_jobs using gin(search_document);
create index if not exists employer_jobs_countries on public.employer_jobs using gin(countries);
create index if not exists employer_jobs_source on public.employer_jobs(source_id);
create index if not exists employer_jobs_posted on public.employer_jobs(posted_at desc) where active;
alter table public.employer_jobs enable row level security;
revoke all on public.employer_jobs from anon, authenticated;
grant all on public.employer_jobs to service_role;

create or replace function public.sync_employer_jobs(p_source_id text, p_jobs jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare imported integer;
begin
  if jsonb_typeof(p_jobs) <> 'array' or jsonb_array_length(p_jobs) = 0 then
    raise exception 'A complete nonempty feed is required';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_source_id));
  if exists(select 1 from jsonb_array_elements(p_jobs) j where j->>'source_id' is distinct from p_source_id) then
    raise exception 'Source mismatch';
  end if;
  insert into public.employer_jobs (id,source_id,source,company,title,location,countries,description,url,level,industry,arrangement,startup,posted_at)
  select id,source_id,source,company,title,location,countries,description,url,level,industry,arrangement,startup,posted_at
  from jsonb_to_recordset(p_jobs) as j(id text,source_id text,source text,company text,title text,location text,countries text[],description text,url text,level text,industry text,arrangement text,startup boolean,posted_at timestamptz)
  on conflict(id) do update set company=excluded.company,title=excluded.title,location=excluded.location,
    countries=excluded.countries,description=excluded.description,url=excluded.url,level=excluded.level,
    industry=excluded.industry,arrangement=excluded.arrangement,startup=excluded.startup,
    posted_at=excluded.posted_at,last_seen=now(),active=true;
  get diagnostics imported = row_count;
  update public.employer_jobs set active=false where source_id=p_source_id
    and id not in (select j->>'id' from jsonb_array_elements(p_jobs) j);
  return jsonb_build_object('imported',imported);
end $$;

create or replace function public.search_employer_jobs(
  p_query text default '', p_country text default 'gb', p_location text default '',
  p_levels text[] default '{}', p_industries text[] default '{}', p_arrangements text[] default '{}',
  p_days integer default null, p_page integer default 1, p_page_size integer default 50
) returns jsonb language sql stable security invoker set search_path = '' as $$
  with filtered as (
    select j.* from public.employer_jobs j
    where j.active and j.last_seen > now() - interval '3 days'
      and p_country = any(j.countries)
      and (p_query = '' or j.search_document @@ websearch_to_tsquery('english',p_query))
      and (p_location = '' or strpos(lower(j.location),lower(p_location)) > 0)
      and (cardinality(p_levels)=0 or j.level = any(p_levels))
      and (cardinality(p_industries)=0 or j.industry = any(p_industries))
      and (cardinality(p_arrangements)=0 or j.arrangement = any(p_arrangements) or ('Startup'=any(p_arrangements) and j.startup))
      and (p_days is null or j.posted_at >= now() - make_interval(days=>p_days))
  ), page as (
    select id,company,title,location,description,url,level,industry,arrangement,source,posted_at
    from filtered order by posted_at desc nulls last,id
    limit least(50,greatest(1,p_page_size)) offset (greatest(1,p_page)-1)*least(50,greatest(1,p_page_size))
  ) select jsonb_build_object('count',(select count(*) from filtered),
    'last_synced',(select max(last_seen) from public.employer_jobs),
    'results',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb));
$$;
revoke all on function public.sync_employer_jobs(text,jsonb) from public,anon,authenticated;
revoke all on function public.search_employer_jobs(text,text,text,text[],text[],text[],integer,integer,integer) from public,anon,authenticated;
grant execute on function public.sync_employer_jobs(text,jsonb) to service_role;
grant execute on function public.search_employer_jobs(text,text,text,text[],text[],text[],integer,integer,integer) to service_role;

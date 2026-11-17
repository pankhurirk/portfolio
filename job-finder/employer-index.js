// Public employer feeds -> private Supabase index -> filtered search.
export function plainText(value = "") {
  return String(value).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}
export function levelFor(title) {
  if (/\b(chief|ceo|cto|cfo|coo|president|executive|vp)\b|vice president/i.test(title)) return "Executive";
  if (/\bdirector\b/i.test(title)) return "Director";
  if (/\b(manager|head of|team lead)\b/i.test(title)) return "Manager";
  if (/\b(junior|entry[- ]level|graduate|trainee)\b/i.test(title)) return "Junior";
  if (/\b(senior|sr|lead|principal|staff)\b/i.test(title)) return "Senior";
  return "Unknown";
}
export function countriesFor(location) {
  const countries = [];
  const explicitGB = /\b(united kingdom|great britain|england|scotland|wales|northern ireland|uk)\b/i.test(location);
  const explicitUS = /\b(united states|usa|u\.s\.)\b/i.test(location) || /,\s*(CA|NY|TX|WA|MA|IL|PA)\b/.test(location);
  const foreign = /\b(canada|ontario|australia|india|germany|france|singapore|japan|netherlands|ireland)\b/i.test(location.replace(/Northern Ireland/ig,''));
  if (explicitGB || (!explicitUS && !foreign && /\b(london|reading|manchester|bristol|edinburgh|belfast|cambridge|oxford|leeds|birmingham)\b/i.test(location))) countries.push("gb");
  if (explicitUS || (!explicitGB && !foreign && /\b(new york|san francisco|boston|seattle|austin|chicago|los angeles|washington dc)\b/i.test(location))) countries.push("us");
  return countries;
}
function isoDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
export function normalizeJob(job, source) {
  const greenhouse = source.type === "greenhouse";
  const title = plainText(greenhouse ? job.title : job.text);
  const location = plainText(greenhouse ? [job.location?.name, ...(job.offices || []).map(o => o.name)].filter(Boolean).join("; ") : job.categories?.location);
  const link = greenhouse ? job.absolute_url : job.hostedUrl;
  if (!job.id || !title || !link || !/^https:\/\//.test(link)) throw new Error("Incomplete employer job");
  const description = plainText(greenhouse ? job.content : [job.descriptionPlain || job.description, ...(job.lists || []).map(l => l.text + " " + l.content), job.additionalPlain || job.additional].filter(Boolean).join(" "));
  const workplace = greenhouse ? location : (job.workplaceType || location);
  const arrangement = /\bhybrid\b/i.test(workplace) ? "Hybrid" : /\bremote\b/i.test(workplace) ? "Remote" : /on[- ]?site|office[- ]based/i.test(workplace) ? "On-site" : "Unknown";
  return { id: source.type + ":" + source.board + ":" + job.id, source_id: source.type + ":" + source.board,
    source: source.type === "greenhouse" ? "Greenhouse" : "Lever", company: source.company,
    title, location, countries: countriesFor(location), description, url: link, level: levelFor(title),
    industry: source.industry || "Unknown", arrangement, startup: source.startup === true,
    posted_at: isoDate(greenhouse ? job.first_published : job.createdAt) };
}
export async function rpc(env, name, body) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Employer index is not configured");
  const response = await fetch(env.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/rpc/" + name, {
    method: "POST", headers: { "Content-Type": "application/json", apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY },
    body: JSON.stringify(body), signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) throw new Error("Employer database request failed (" + response.status + ")");
  return response.json();
}
export function parseSources(raw) {
  const sources = JSON.parse(raw || "[]");
  if (!Array.isArray(sources) || sources.length > 20) throw new Error("Configure at most 20 employer boards per Worker");
  const ids = new Set();
  for (const source of sources) {
    if (!["greenhouse", "lever"].includes(source.type) || !/^[a-zA-Z0-9_-]+$/.test(source.board) || !source.company || (source.region && source.region !== "eu")) throw new Error("Invalid employer source");
    const id = source.type + ":" + source.board;
    if (ids.has(id)) throw new Error("Duplicate employer board");
    ids.add(id);
  }
  return sources;
}
export async function collectEmployers(env) {
  const sources = parseSources(env.EMPLOYER_SOURCES);
  if (!sources.length) throw new Error("No employer boards configured");
  const results = [];
  // Sequential collection bounds upstream traffic; a failed board never closes its jobs.
  for (const source of sources) {
    try {
      const url = source.type === "greenhouse"
        ? "https://boards-api.greenhouse.io/v1/boards/" + source.board + "/jobs?content=true"
        : "https://api." + (source.region === "eu" ? "eu." : "") + "lever.co/v0/postings/" + source.board + "?mode=json";
      const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error("Feed HTTP " + response.status);
      const data = await response.json();
      const jobs = source.type === "greenhouse" ? data.jobs : data;
      if (!Array.isArray(jobs) || !jobs.length || jobs.length > 5000) throw new Error("Empty or invalid feed; existing jobs retained");
      if (source.type === "greenhouse" && data.meta?.total != null && data.meta.total !== jobs.length) throw new Error("Incomplete feed; existing jobs retained");
      const normalized = jobs.map(job => normalizeJob(job, source));
      const result = await rpc(env, "sync_employer_jobs", { p_source_id: source.type + ":" + source.board, p_jobs: normalized });
      results.push({ board: source.board, ok: true, ...result });
    } catch (error) { results.push({ board: source.board, ok: false, error: error.message }); }
  }
  console.log(JSON.stringify({ event: "employer_collection", results }));
  return results;
}
export async function searchEmployers(url, env) {
  const values = name => (url.searchParams.get(name) || "").split(",").map(s => s.trim()).filter(Boolean).slice(0, 10);
  const page = Math.max(1, Math.min(1000, parseInt(url.searchParams.get("page"), 10) || 1));
  const days = Number(url.searchParams.get("posted"));
  const country = url.searchParams.get("country") === "us" ? "us" : "gb";
  const where = (url.searchParams.get("where") || "").trim().slice(0, 100);
  const countryWide = !where || ["uk", "gb", "great britain", "united kingdom", "us", "usa", "united states", "united states of america"].includes(where.toLowerCase());
  const data = await rpc(env, "search_employer_jobs", { p_query: (url.searchParams.get("what") || "").trim().slice(0, 120), p_country: country,
    p_location: countryWide ? "" : where, p_levels: values("levels"), p_industries: values("industries"), p_arrangements: values("arrangements"),
    p_days: [1, 3, 7, 14, 30].includes(days) ? days : null, p_page: page, p_page_size: 50 });
  return { provider: "Employer index", count: data.count, page, page_size: 50, last_synced: data.last_synced,
    results: data.results.map(j => ({ id: j.id, title: j.title, description: j.description, company: { display_name: j.company },
      location: { display_name: j.location }, category: { label: j.industry }, redirect_url: j.url, created: j.posted_at,
      level: j.level, industry: j.industry, arrangement: j.arrangement, source: j.source })) };
}

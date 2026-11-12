const ALLOWED_ORIGINS = new Set([
  "https://www.pankhuriverma.com",
  "https://pankhuriverma.com",
  "https://pankhurirk.github.io"
]);

function makeResponse(body, status, origin) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }

  return new Response(JSON.stringify(body), { status, headers });
}

function trimmedParam(url, name, maxLength) {
  return (url.searchParams.get(name) || "").trim().slice(0, maxLength);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      if (!ALLOWED_ORIGINS.has(origin)) {
        return new Response(null, { status: 403 });
      }

      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
          "Vary": "Origin"
        }
      });
    }

    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return makeResponse({ error: "Origin not allowed." }, 403, "");
    }

    if (url.pathname === "/" || url.pathname === "/health") {
      return makeResponse({ ok: true, service: "UK Job Finder API" }, 200, origin);
    }

    if (url.pathname !== "/api/jobs" || request.method !== "GET") {
      return makeResponse({ error: "Use GET /api/jobs." }, 404, origin);
    }

    if (!env.ADZUNA_APP_ID || !env.ADZUNA_APP_KEY) {
      return makeResponse({
        error: "The job search API is not configured yet. Add ADZUNA_APP_ID and ADZUNA_APP_KEY as Worker secrets."
      }, 503, origin);
    }

    const what = trimmedParam(url, "what", 120);
    const where = trimmedParam(url, "where", 100) || "United Kingdom";
    const distance = Number.parseInt(url.searchParams.get("distance") || "25", 10);
    const posted = Number.parseInt(url.searchParams.get("posted") || "", 10);

    const allowedDistances = new Set([5, 10, 25, 50, 100]);
    const allowedPostedDays = new Set([1, 3, 7, 14, 30]);

    const apiUrl = new URL("https://api.adzuna.com/v1/api/jobs/gb/search/1");
    apiUrl.searchParams.set("app_id", env.ADZUNA_APP_ID);
    apiUrl.searchParams.set("app_key", env.ADZUNA_APP_KEY);
    apiUrl.searchParams.set("results_per_page", "20");
    apiUrl.searchParams.set("content-type", "application/json");

    if (what) apiUrl.searchParams.set("what", what);
    apiUrl.searchParams.set("where", where);

    if (where.toLowerCase() !== "united kingdom" && allowedDistances.has(distance)) {
      apiUrl.searchParams.set("distance", String(distance));
    }

    if (allowedPostedDays.has(posted)) {
      apiUrl.searchParams.set("max_days_old", String(posted));
    }

    try {
      const upstream = await fetch(apiUrl.toString(), {
        headers: { Accept: "application/json" }
      });

      const data = await upstream.json();

      if (!upstream.ok) {
        return makeResponse({
          error: "The job provider could not complete the search.",
          providerStatus: upstream.status
        }, upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502, origin);
      }

      return makeResponse({
        results: Array.isArray(data.results) ? data.results : [],
        count: Number.isFinite(data.count) ? data.count : 0,
        mean: Number.isFinite(data.mean) ? data.mean : null,
        provider: "Adzuna"
      }, 200, origin);
    } catch (error) {
      return makeResponse({ error: "Could not reach the job listings service." }, 502, origin);
    }
  }
};

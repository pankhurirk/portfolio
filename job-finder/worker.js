const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Accept, Content-Type",
  "Access-Control-Max-Age": "86400"
};

function makeResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function trimmedParam(url, name, maxLength) {
  return (url.searchParams.get(name) || "").trim().slice(0, maxLength);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (url.pathname === "/" || url.pathname === "/health") {
      return makeResponse({ ok: true, service: "UK Job Finder API" }, 200);
    }

    if (url.pathname !== "/api/jobs" || request.method !== "GET") {
      return makeResponse({ error: "Use GET /api/jobs." }, 404);
    }

    if (!env.ADZUNA_APP_ID || !env.ADZUNA_APP_KEY) {
      return makeResponse({
        error: "The job search API is not configured yet. Add ADZUNA_APP_ID and ADZUNA_APP_KEY as Worker secrets."
      }, 503);
    }

    const what = trimmedParam(url, "what", 120);
    const where = trimmedParam(url, "where", 100);
    const distance = Number.parseInt(url.searchParams.get("distance") || "25", 10);
    const posted = Number.parseInt(url.searchParams.get("posted") || "", 10);
    const isUkWide = !where || ["uk", "united kingdom", "great britain"].includes(where.toLowerCase());

    const allowedDistances = new Set([5, 10, 25, 50, 100]);
    const allowedPostedDays = new Set([1, 3, 7, 14, 30]);

    const apiUrl = new URL("https://api.adzuna.com/v1/api/jobs/gb/search/1");
    apiUrl.searchParams.set("app_id", env.ADZUNA_APP_ID);
    apiUrl.searchParams.set("app_key", env.ADZUNA_APP_KEY);
    apiUrl.searchParams.set("results_per_page", "20");
    apiUrl.searchParams.set("content-type", "application/json");

    if (what) apiUrl.searchParams.set("what", what);
    if (!isUkWide) apiUrl.searchParams.set("where", where);

    if (!isUkWide && allowedDistances.has(distance)) {
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
        }, upstream.status);
      }

      return makeResponse({
        results: Array.isArray(data.results) ? data.results : [],
        count: Number.isFinite(data.count) ? data.count : 0,
        mean: Number.isFinite(data.mean) ? data.mean : null,
        provider: "Adzuna"
      }, 200);
    } catch (error) {
      return makeResponse({ error: "Could not reach the job listings service." }, 502);
    }
  }
};

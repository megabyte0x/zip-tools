const PUBLIC_PAGE = /^(?:\/|\/(?:zips|graph|list)|\/zip\/\d+|\/draft\/[a-z0-9-]+|\/nu\/[a-z0-9.-]+)$/;

export function cachePublicPage(request: Request, response: Response): Response {
  const url = new URL(request.url);
  if (!PUBLIC_PAGE.test(url.pathname)) {
    if (response.headers.has("Cache-Control") && !url.pathname.startsWith("/api/")) return response;
    const headers = new Headers(response.headers);
    // Without an explicit directive, Workers Caching applies a default TTL to API responses.
    headers.set("Cache-Control", "private, no-store");
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }

  const headers = new Headers(response.headers);
  const vary = new Set((headers.get("Vary") ?? "").toLowerCase().split(",").map((value) => value.trim()).filter(Boolean));
  for (const name of ["cookie", "authorization", "rsc", "next-router-state-tree", "next-router-prefetch", "next-router-segment-prefetch", "next-url", "next-action"]) {
    vary.add(name);
  }
  headers.set("Vary", [...vary].join(", "));

  const contentType = headers.get("Content-Type") ?? "";
  const cacheable = request.method === "GET" && response.status === 200 &&
    !request.headers.has("Cookie") && !request.headers.has("Authorization") &&
    !request.headers.has("Next-Action") && !headers.has("Set-Cookie") &&
    /^(?:text\/html|text\/x-component)(?:;|$)/i.test(contentType);

  if (cacheable) {
    // The homepage includes trending data and the daily proposal; other pages use a pinned snapshot.
    const ttl = url.pathname === "/" ? 300 : 3600;
    headers.set("Cache-Control", `public, max-age=60, s-maxage=${ttl}, stale-while-revalidate=300`);
  } else {
    headers.set("Cache-Control", "private, no-store");
  }

  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

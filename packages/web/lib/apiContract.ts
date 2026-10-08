import { REPOSITORY } from "./siteInfo";

export function checkApiVersion(request: Request): Response | null {
  const version = request.headers.get("X-API-Version");
  return version === null || version === "1" ? null : Response.json({ error: "unsupported_api_version" }, { status: 400 });
}

export function withApiVersion(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("X-API-Version", "1");
  const vary = new Set((headers.get("Vary") ?? "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean));
  vary.add("x-api-version");
  headers.set("Vary", [...vary].join(", "));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

const problems: Record<number, [string, string]> = {
  400: ["Invalid request", "The request body or parameters are invalid. For view counts, send a JSON object containing a known proposal id."],
  404: ["Resource not found", "The API resource is absent or the requested feature is disabled. See /openapi.json for available endpoints."],
  405: ["Method not allowed", "Use the HTTP method documented for this endpoint in /openapi.json. Successful view submissions use POST."],
  422: ["Proposal body unavailable", "This proposal has no source body from which to generate a summary. Follow its official source link instead."],
  429: ["Too many requests", "Wait before retrying this request. Honor the Retry-After header when one is supplied."],
  503: ["Service unavailable", "The optional summary provider is unavailable. Read the proposal text directly or retry later."],
};

export async function apiProblemResponse(request: Request, response: Response): Promise<Response> {
  if (response.status < 400) return response;
  let existing: Record<string, unknown> = {};
  if (response.headers.get("Content-Type")?.includes("json")) {
    try { const body = await response.clone().json(); if (body && typeof body === "object" && !Array.isArray(body)) existing = body; } catch {}
  }
  const [title, detail] = existing.error === "unsupported_api_version"
    ? ["Unsupported API version", "Send X-API-Version: 1 or omit the header to use the current default version."]
    : problems[response.status] ?? ["API request failed", "The service could not complete this request. Consult /openapi.json and retry later if appropriate."];
  const headers = new Headers(response.headers);
  headers.delete("Content-Length");
  headers.delete("Content-Encoding");
  headers.set("Content-Type", "application/problem+json; charset=utf-8");
  headers.set("Cache-Control", "private, no-store");
  const problem = { ...existing, type: "about:blank", title, status: response.status, detail, instance: new URL(request.url).pathname, code: typeof existing.error === "string" ? existing.error : `http_${response.status}`, resolution: "Consult the documented method, parameters, and responses at /openapi.json." };
  return new Response(request.method === "HEAD" ? null : JSON.stringify(problem), { status: response.status, statusText: response.statusText, headers });
}

const problemSchema = {
  type: "object", description: "RFC 9457 problem details with a stable error code and recovery guidance.",
  required: ["type", "title", "status", "detail", "instance", "code", "resolution"],
  properties: {
    type: { type: "string", description: "Problem type URI; about:blank uses the HTTP status meaning." },
    title: { type: "string", description: "Short human-readable error title." },
    status: { type: "integer", description: "The HTTP error status.", minimum: 400, maximum: 599 },
    detail: { type: "string", description: "Explanation of the error without implementation internals." },
    instance: { type: "string", description: "The API path on which the error occurred." },
    code: { type: "string", description: "Stable machine-readable error code." },
    resolution: { type: "string", description: "How to recover or find the correct request contract." },
    error: { type: "string", description: "Optional legacy summary error code, preserved for existing clients." },
  },
};
const problemResponse = (description: string) => ({ description, content: { "application/problem+json": { schema: problemSchema } } });
const versionParameter = { name: "X-API-Version", in: "header", required: false, description: "API contract version. Version 1 is the default when omitted; unsupported versions return 400. Incompatible changes require a new version. If retirement is scheduled, responses will carry Deprecation and Sunset headers and the replacement contract will be linked in this guide. No retirement is currently scheduled.", schema: { type: "string", enum: ["1"], default: "1" } };

export function openApiDocument(origin: string) {
  return {
    openapi: "3.1.1",
    info: {
      title: "ZIP.tools supporting API", version: "1.0.0",
      description: "Existing public endpoints for aggregate proposal readership and optional summaries. To read proposal specifications, use normal proposal URLs with Accept: text/markdown. There are no user accounts or credential flows. Summaries are disabled in this deployment. No transaction, wallet, or blockchain-write operation is provided.",
      contact: { name: "ZIP.tools issue tracker", url: `${REPOSITORY}/issues` },
    },
    servers: [{ url: origin, description: "ZIP.tools production server" }],
    externalDocs: { description: "Agent guide and source provenance", url: `${origin}/docs` },
    security: [],
    paths: {
      "/api/trending": {
        get: {
          operationId: "listTrendingProposals", summary: "Read aggregate proposal popularity",
          parameters: [versionParameter],
          description: "Return up to twelve proposals ordered by readership count over the last seven UTC days. This is a bounded ranking, not a pageable proposal catalog. It may return an empty list if counters are unavailable. No account or API key is required.",
          responses: {
            "200": { description: "The bounded popularity list.", content: { "application/json": { schema: {
              type: "object", required: ["items"], properties: { items: { type: "array", description: "Proposals ordered by decreasing aggregate readership.", maxItems: 12, items: {
                type: "object", required: ["id", "count"], properties: { id: { type: "string", description: "Proposal id in the pinned snapshot." }, count: { type: "integer", minimum: 0, description: "Aggregated readership count." } },
              } } },
            } } } },
            "400": problemResponse("Unsupported API contract version."), "405": problemResponse("Use GET for this endpoint."), "500": problemResponse("The endpoint could not complete the request."),
          },
        },
      },
      "/api/views": {
        post: {
          operationId: "recordProposalView", summary: "Record one proposal reading event",
          parameters: [versionParameter],
          description: "Browser telemetry endpoint. Record a reading of a known proposal; repeated proposal/IP-hash events are suppressed for about thirty minutes. A 204 response does not guarantee persistent recording because counting is best effort. Agents retrieving reference text do not need to call this endpoint. No account or API key is required.",
          requestBody: { required: true, description: "The proposal that was read.", content: { "application/json": { schema: { type: "object", required: ["id"], properties: { id: { type: "string", minLength: 1, description: "An existing proposal id, for example 32." } } }, example: { id: "32" } } } },
          responses: { "204": { description: "The event was handled, suppressed as a repeat, or ignored because counters are unavailable. No response body." }, "400": problemResponse("Malformed JSON, absent id, or an id outside the snapshot."), "405": problemResponse("Use POST for this endpoint."), "500": problemResponse("The endpoint could not complete the request.") },
        },
      },
      "/api/summary/{id}": {
        get: {
          operationId: "getProposalSummary", summary: "Read an optional generated proposal summary",
          description: "This optional feature is currently disabled, so production returns 404 with code disabled. If enabled by the operator, it retrieves or generates a short summary of a source-backed proposal. The summary is not an authoritative specification. Read the proposal directly for protocol details.",
          parameters: [{ name: "id", in: "path", required: true, description: "Numbered proposal id or an existing draft slug.", schema: { type: "string", minLength: 1 }, example: "32" }, versionParameter],
          responses: {
            "200": { description: "Generated summary when the feature is enabled.", content: { "application/json": { schema: { type: "object", required: ["text", "generated", "cached"], properties: { text: { type: "string", description: "Generated summary text." }, generated: { type: "boolean", const: true, description: "Identifies text as generated." }, cached: { type: "boolean", description: "Whether the summary came from the snapshot-keyed cache." } } } } } },
            "400": problemResponse("Unsupported API contract version."), "404": problemResponse("Feature disabled or proposal not found."), "405": problemResponse("Use GET for this endpoint."), "422": problemResponse("No source body is available."), "503": problemResponse("Summary provider unavailable."),
          },
        },
      },
    },
  };
}

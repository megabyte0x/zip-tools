import assert from "node:assert/strict";
import { test } from "node:test";
import { apiProblemResponse, openApiDocument, checkApiVersion, withApiVersion } from "./apiContract.ts";

test("API failures become structured problems without leaking HTML and preserve method hints", async () => {
  const request = new Request("https://example.com/api/views");
  const response = await apiProblemResponse(request, new Response("<html>Internal implementation</html>", { status: 405, headers: { Allow: "POST" } }));
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("Allow"), "POST");
  assert.match(response.headers.get("Content-Type")!, /^application\/problem\+json/);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  const body = await response.json();
  assert.equal(body.status, 405);
  assert.equal(body.instance, "/api/views");
  assert.equal(body.code, "http_405");
  assert.ok(body.detail.length > 20);
  assert.ok(!JSON.stringify(body).includes("Internal implementation"));
});

test("disabled-summary error remains compatible and successful API responses stay intact", async () => {
  const request = new Request("https://example.com/api/summary/32");
  const disabled = await apiProblemResponse(request, Response.json({ error: "disabled" }, { status: 404 }));
  const body = await disabled.json();
  assert.equal(body.error, "disabled");
  assert.equal(body.code, "disabled");
  const success = Response.json({ items: [{ id: "32", count: 2 }] });
  assert.equal(await apiProblemResponse(request, success), success);
});

test("OpenAPI describes real endpoints with unique callable operations and typed responses", () => {
  const spec = openApiDocument("https://example.com");
  assert.match(spec.openapi, /^3\.1\./);
  assert.equal(spec.servers[0].url, "https://example.com");
  assert.deepEqual(Object.keys(spec.paths).sort(), ["/api/summary/{id}", "/api/trending", "/api/views"]);
  assert.equal(spec.paths["/api/views"].post.operationId, "recordProposalView");
  assert.equal(spec.paths["/api/trending"].get.responses["200"].content["application/json"].schema.required[0], "items");
  assert.equal(spec.paths["/api/summary/{id}"].get.parameters[0].required, true);
});

test("API version one is explicit, defaults for existing clients and rejects unsupported versions", async () => {
  assert.equal(checkApiVersion(new Request("https://example.com/api/trending")), null);
  assert.equal(checkApiVersion(new Request("https://example.com/api/trending", { headers: { "X-API-Version": "1" } })), null);
  const request = new Request("https://example.com/api/trending", { headers: { "X-API-Version": "2" } });
  const rejected = await apiProblemResponse(request, checkApiVersion(request)!);
  assert.equal(rejected.status, 400);
  assert.equal((await rejected.json()).code, "unsupported_api_version");
  const response = withApiVersion(Response.json({ items: [] }));
  assert.equal(response.headers.get("X-API-Version"), "1");
  assert.match(response.headers.get("Vary")!, /x-api-version/i);
  const spec = openApiDocument("https://example.com");
  assert.equal(spec.paths["/api/trending"].get.parameters[0].name, "X-API-Version");
});

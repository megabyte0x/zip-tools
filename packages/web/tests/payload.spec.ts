import { expect, test } from "@playwright/test";

test.skip(process.env.ZIP_TEST_GRAPH_OBSERVERS === "development", "Production payloads omit React's development debug props.");

for (const route of ["/", "/zips", "/graph", "/zip/32", "/draft/draft-arya-jvff-p2p-quic-transport"]) {
  test(`${route} keeps article bodies and provenance out of client props`, async ({ request }) => {
    const response = await request.get(route);
    expect(response.status()).toBe(200);
    const html = await response.text();
    const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)]
      .map((match) => match[1]).join("");
    expect(scripts).toContain("self.__next_f.push");
    for (const field of ["body", "bodySource", "sourcePath", "parseWarnings"]) {
      expect(scripts.includes(`\\"${field}\\":`), `${field} must stay on the server`).toBe(false);
    }
  });
}

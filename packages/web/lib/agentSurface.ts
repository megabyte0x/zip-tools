import type { ZipIndexFile } from "./types";
import { htmlToMarkdown, paginateReader, partHref } from "./agentDocuments";
import { prepareReader } from "./prepareReader";
import { resolveZip, resolveDraft } from "./resolve";
import { zipHref } from "./zipHref";
import { INFO_PAGES, getInfoPage, infoMarkdown, REPOSITORY } from "./siteInfo";
import { openApiDocument } from "./apiContract";

const escapeXml = (value: string) => value.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);
const quality = (accept: string, type: string) => Math.max(0, ...accept.split(",").filter((item) => item.split(";")[0].trim().toLowerCase() === type).map((item) => Number(/;\s*q=([\d.]+)/i.exec(item)?.[1] ?? 1)));

export function withRepresentationHeaders(request: Request, response: Response, path: string): Response {
  const headers = new Headers(response.headers);
  const vary = new Set((headers.get("Vary") ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
  for (const name of ["accept", "cookie", "authorization", "rsc", "next-action"]) vary.add(name);
  headers.set("Vary", [...vary].join(", "));
  const url = new URL(path, request.url);
  const alternate = /^(?:text\/html|text\/markdown|text\/x-component)/i.test(headers.get("Content-Type") ?? "")
    ? `, <${url.origin}${url.pathname === "/" ? "/index" : url.pathname}.md${url.search}>; rel="alternate"; type="text/markdown"` : "";
  headers.set("Link", `<${url.href}>; rel="canonical"${alternate}, <${url.origin}/sitemap.xml>; rel="sitemap", <${url.origin}/docs>; rel="describedby", <${url.origin}/openapi.json>; rel="service-desc"; type="application/vnd.oai.openapi+json"`);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export async function agentResponse(request: Request, index: ZipIndexFile): Promise<Response | null> {
  if (!["GET", "HEAD"].includes(request.method)) return null;
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/") || request.headers.has("RSC") || request.headers.has("Next-Action")) return null;
  const explicit = url.pathname.endsWith(".md");
  const path = explicit ? url.pathname.slice(0, -3).replace(/^\/index$/, "/") : url.pathname;
  const accept = request.headers.get("Accept") ?? "";
  const wantsMarkdown = explicit || (quality(accept, "text/markdown") > 0 && quality(accept, "text/markdown") >= quality(accept, "text/html"));
  const origin = url.origin;
  const proposalLinks = index.zips.map((zip) => `- [${zip.number === null ? "Draft" : `ZIP ${zip.number}`}: ${zip.title}](${origin}${zipHref(zip)})`).join("\n");
  const snapshot = `Snapshot: ${index.snapshot.sha}\n\nSource date: ${index.snapshot.date}\n\n[Source revision](${index.snapshot.url})`;
  const response = (body: string, type = "text/markdown", status = 200) => {
    const headers = new Headers({ "Content-Type": `${type}; charset=utf-8`, "Cache-Control": status === 200 && !request.headers.has("Cookie") && !request.headers.has("Authorization") ? "public, max-age=60, s-maxage=3600" : "private, no-store" });
    return withRepresentationHeaders(request, new Response(request.method === "HEAD" ? null : body, { status, headers }), path + url.search);
  };
  const missing = () => response(`# Page not found\n\nThe requested proposal, page, or document part does not exist in this snapshot.\n\n[Browse proposals](${origin}/zips) · [Agent guide](${origin}/docs) · [Sitemap](${origin}/sitemap.xml)`, "text/markdown", 404);

  if (path === "/openapi.json") return response(JSON.stringify(openApiDocument(origin)), "application/json");
  if (path === "/.well-known/api-catalog") return response(JSON.stringify({ linkset: [{ anchor: origin + "/", "service-desc": [{ href: origin + "/openapi.json", type: "application/vnd.oai.openapi+json" }], "service-doc": [{ href: origin + "/docs" }] }] }), "application/linkset+json");

  if (path === "/robots.txt") return response(`User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${origin}/sitemap.xml\n`, "text/plain");
  if (path === "/sitemap.xml") {
    const paths = ["/", "/zips", "/graph", ...Object.keys(INFO_PAGES).map((id) => `/${id}`), ...index.zips.map(zipHref), ...index.nus.map((nu) => `/nu/${nu.id}`)];
    return response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((href) => `<url><loc>${escapeXml(origin + href)}</loc><lastmod>${index.snapshot.date.slice(0, 10)}</lastmod></url>`).join("")}</urlset>`, "application/xml");
  }
  if (path === "/llms.txt") return response(`# ZIP.tools\n\n> An independent, free reference explorer for Zcash Improvement Proposals from a pinned zcash/zips snapshot.\n\n## When to use\n\nUse this site to read ZIP specifications, inspect drafts, find upgrade proposals, and follow citations. For live protocol state, check official sources.\n\n## Reading instructions\n\nGET any public page with Accept: text/markdown, or append .md. Long proposals link all their parts with ?part=N. Follow every part for full text. Preserve source status, owners, and snapshot provenance when answering. No account, key, payment, or API integration is needed.\n\n## Resources\n\n- [Agent guide](${origin}/docs.md)\n- [Supporting API contract](${origin}/openapi.json)\n- [Proposal index](${origin}/zips.md)\n- [Citation relationships](${origin}/graph.md)\n- [Sitemap](${origin}/sitemap.xml)\n- [About](${origin}/about.md)\n- [Privacy](${origin}/privacy.md)\n- [Contact](${origin}/contact.md)\n- [Source repository](${REPOSITORY})\n\n## Limitations\n\nThis is an independent snapshot explorer, not an official authority. /list stores bookmarks only in the reader's browser. Some proposals contain only metadata; follow their official or discussion source.\n\n${snapshot}\n`, "text/plain");
  if (!wantsMarkdown) return null;
  if (path === "/" || path === "/zips") return response(`# ZIP.tools — Zcash Improvement Proposals\n\nRead proposals and drafts, follow their citations, and inspect network upgrades. Public reference access is free.\n\n[Agent guide](${origin}/docs) · [About](${origin}/about) · [Contact](${origin}/contact) · [Privacy](${origin}/privacy)\n\n${snapshot}\n\n## Proposals\n\n${proposalLinks}`);
  const zipMatch = /^\/zip\/([^/]+)$/.exec(path);
  const draftMatch = /^\/draft\/([^/]+)$/.exec(path);
  if (zipMatch || draftMatch) {
    const zip = zipMatch ? resolveZip(index, zipMatch[1]) : resolveDraft(index, draftMatch![1]);
    if (!zip) return missing();
    const href = zipHref(zip);
    const parts = paginateReader(await prepareReader(zip), href);
    const selected = Number(url.searchParams.get("part") ?? 1);
    if (!Number.isInteger(selected) || selected < 1 || selected > parts.length) return missing();
    const navigation = parts.length > 1 ? `## Document parts\n\n${parts.map((_, i) => `[Part ${i + 1}](${origin}${partHref(href, i + 1)})`).join(" · ")}\n\nReading part ${selected} of ${parts.length}. Follow all parts for the complete proposal.\n\n` : "";
    const body = parts[selected - 1].html ? htmlToMarkdown(parts[selected - 1].html) : "No proposal body is available in this snapshot. Follow the official or discussion link below.";
    const sources = `[Official source](${zip.officialUrl}) · [Source file](${zip.githubUrl})${zip.discussionsTo ? ` · [Discussion](${zip.discussionsTo})` : ""}`;
    const citations = `Cites: ${zip.citations.map((id) => `[ZIP ${id}](${origin}/zip/${id})`).join(", ") || "None"}\n\nCited by: ${zip.citedBy.map((id) => `[ZIP ${id}](${origin}/zip/${id})`).join(", ") || "None"}`;
    return response(`# ${zip.number === null ? "Draft" : `ZIP ${zip.number}`}: ${zip.title}\n\nStatus: ${zip.status.map((status) => status.label).join(", ")}\n\nOwners: ${zip.owners.map((owner) => owner.name).join(", ")}\n\n${snapshot}\n\n${sources}\n\n${navigation}${body}\n\n## Citation relationships\n\n${citations}`);
  }
  if (path === "/graph") return response(`# Citation relationships\n\nEach numbered proposal lists the proposals it cites. This is the text equivalent of the interactive graph.\n\n${snapshot}\n\n${index.zips.filter((zip) => zip.number !== null).map((zip) => `- [ZIP ${zip.number}: ${zip.title}](${origin}${zipHref(zip)}): ${zip.citations.map((id) => `[ZIP ${id}](${origin}/zip/${id})`).join(", ") || "no outgoing citations"}`).join("\n")}`);
  if (path === "/list") return response("# Reading list\n\nBookmarks are stored only in your own browser. An agent cannot retrieve them through this URL. Use Copy list links in your browser and share the individual proposal URLs.\n\n[Browse proposals](/zips)");
  if (getInfoPage(path.slice(1))) return response(infoMarkdown(path.slice(1)));
  const nu = /^\/nu\/(.+)$/.exec(path);
  if (nu) {
    const upgrade = index.nus.find((entry) => entry.id === nu[1]);
    if (!upgrade) return missing();
    return response(`# ${upgrade.title}\n\nStage: ${upgrade.kind}\n\n${snapshot}\n\n${upgrade.zips.map((id) => `- [ZIP ${id}](${origin}/zip/${id})`).join("\n")}`);
  }
  return missing();
}

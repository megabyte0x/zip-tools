// @ts-ignore `.open-next/worker.js` is generated at OpenNext build
import { default as handler } from "./.open-next/worker.js";
import { WorkerEntrypoint } from "cloudflare:workers";
import { handleScheduledRollup, type ViewsEnv } from "./lib/views";
import { cachePublicPage } from "./lib/publicPageCache";
import { agentResponse, withRepresentationHeaders } from "./lib/agentSurface";
import bundledIndex from "./data/zip-index.json";
import sitemapParts from "./data/sitemap-parts.json";
import type { ZipIndexFile } from "./lib/types";
import { apiProblemResponse, checkApiVersion, withApiVersion } from "./lib/apiContract";
import { canonicalRedirect } from "./lib/seo";

type SiteEnv = { ASSETS: { fetch(request: Request): Promise<Response> } };

async function serveSite(request: Request, env: SiteEnv, ctx: unknown): Promise<Response> {
  if (request.method === "GET" || request.method === "HEAD") {
    const asset = await env.ASSETS.fetch(request);
    if (asset.status !== 404) return asset;
  }
  const direct = await agentResponse(request, bundledIndex as ZipIndexFile, sitemapParts);
  if (direct) return direct;
  const url = new URL(request.url);
  const isApi = url.pathname.startsWith("/api/");
  const versionError = isApi ? checkApiVersion(request) : null;
  if (versionError) return withApiVersion(await apiProblemResponse(request, versionError));
  const response = await handler.fetch(request, env, ctx);
  const type = response.headers.get("Content-Type") ?? "";
  if (isApi) return cachePublicPage(request, withApiVersion(await apiProblemResponse(request, response)));
  return cachePublicPage(request, /^(?:text\/html|text\/x-component)/i.test(type)
    ? withRepresentationHeaders(request, response, url.pathname + url.search)
    : response);
}

export class CachedSite extends WorkerEntrypoint<SiteEnv> {
  async fetch(request: Request) { return serveSite(request, this.env, this.ctx); }
}

export default {
  async fetch(request: Request, env: SiteEnv, ctx: { exports: { CachedSite: { fetch(request: Request, options: { cf: { cacheKey: string } }): Promise<Response> } } }) {
    const url = new URL(request.url);
    const redirect = canonicalRedirect(url);
    if (redirect) return Response.redirect(redirect.href, 308);
    // API and mutation requests need the original client context, not a cache loopback.
    if (url.pathname.startsWith("/api/") || !["GET", "HEAD"].includes(request.method)) return serveSite(request, env, ctx);
    return ctx.exports.CachedSite.fetch(request, { cf: { cacheKey: request.url } });
  },

  async scheduled(_controller: unknown, env: ViewsEnv) {
    await handleScheduledRollup(env, []);
  },
};

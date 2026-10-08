// @ts-ignore `.open-next/worker.js` is generated at OpenNext build
import { default as handler } from "./.open-next/worker.js";
import { handleScheduledRollup, type ViewsEnv } from "./lib/views";
import { cachePublicPage } from "./lib/publicPageCache";
import { agentResponse, withRepresentationHeaders } from "./lib/agentSurface";
import bundledIndex from "./data/zip-index.json";
import type { ZipIndexFile } from "./lib/types";
import { apiProblemResponse, checkApiVersion, withApiVersion } from "./lib/apiContract";

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const direct = await agentResponse(request, bundledIndex as ZipIndexFile);
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
  },

  async scheduled(_controller: unknown, env: ViewsEnv) {
    await handleScheduledRollup(env, []);
  },
};

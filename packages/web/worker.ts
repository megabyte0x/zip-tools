// @ts-ignore `.open-next/worker.js` is generated at OpenNext build
import { default as handler } from "./.open-next/worker.js";
import { handleScheduledRollup, type ViewsEnv } from "./lib/views";
import { cachePublicPage } from "./lib/publicPageCache";

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    return cachePublicPage(request, await handler.fetch(request, env, ctx));
  },

  async scheduled(_controller: unknown, env: ViewsEnv) {
    await handleScheduledRollup(env, []);
  },
};

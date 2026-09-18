// @ts-ignore `.open-next/worker.js` is generated at OpenNext build
import { default as handler } from "./.open-next/worker.js";
import { handleScheduledRollup, type ViewsEnv } from "./lib/views";

export default {
  fetch: handler.fetch,

  async scheduled(_controller: unknown, env: ViewsEnv) {
    await handleScheduledRollup(env, []);
  },
};

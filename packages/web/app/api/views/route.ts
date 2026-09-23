import { handleViewsPost, type ViewsEnv } from "../../../lib/views";
import { cloudflareEnv } from "../../../lib/cloudflareEnv";

async function loadEnv(): Promise<ViewsEnv> {
  return cloudflareEnv<ViewsEnv>();
}

export async function POST(request: Request): Promise<Response> {
  return handleViewsPost(request, await loadEnv(), Date.now());
}

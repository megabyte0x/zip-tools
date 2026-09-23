const cloudflareContextSymbol = Symbol.for("__cloudflare-context__");

type RuntimeEnvironment = { NODE_ENV?: string; NEXT_RUNTIME?: string };
type CloudflareContext = { env: unknown };
type CloudflareContextLoader = () => Promise<CloudflareContext>;

function isPlainNodeNextStart(environment: RuntimeEnvironment, scope: object): boolean {
  return environment.NODE_ENV === "production" &&
    environment.NEXT_RUNTIME === "nodejs" &&
    !(cloudflareContextSymbol in scope);
}

async function loadCloudflareContext(): Promise<CloudflareContext> {
  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  return getCloudflareContext({ async: true }) as Promise<CloudflareContext>;
}

export async function cloudflareEnv<T extends object>(
  loadContext: CloudflareContextLoader = loadCloudflareContext,
  environment: RuntimeEnvironment = process.env,
  scope: object = globalThis,
): Promise<T> {
  if (isPlainNodeNextStart(environment, scope)) return {} as T;
  try {
    return (await loadContext()).env as T;
  } catch {
    return {} as T;
  }
}

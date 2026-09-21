import type { ExplorerQuery } from "./workbenchContracts";

const EXPLORER_KEYS = ["q", "kind", "status", "nu", "category", "sort"] as const;

export function parseZipsQuery(search: string): ExplorerQuery {
  const queryStart = search.indexOf("?");
  const fragmentStart = search.indexOf("#");
  const raw = search.startsWith("?")
    ? search.slice(1, fragmentStart === -1 ? undefined : fragmentStart)
    : queryStart >= 0
      ? search.slice(queryStart + 1, fragmentStart === -1 ? undefined : fragmentStart)
      : search.slice(0, fragmentStart === -1 ? undefined : fragmentStart);
  const params = new URLSearchParams(raw);
  const rawKind = params.get("kind") ?? "";
  const rawSort = params.get("sort") ?? "";

  return {
    text: params.get("q") ?? "",
    kind: rawKind === "draft" || rawKind === "numbered" ? rawKind : "",
    status: params.get("status") ?? "",
    nuId: params.get("nu") ?? "",
    category: params.get("category") ?? "",
    sort: rawSort === "title" ? "title" : "number",
  };
}

export function serializeZipsQuery(query: ExplorerQuery, existing = ""): string {
  const fragmentIndex = existing.indexOf("#");
  const fragment = fragmentIndex >= 0 ? existing.slice(fragmentIndex) : "";
  const withoutFragment = fragmentIndex >= 0 ? existing.slice(0, fragmentIndex) : existing;
  const queryIndex = withoutFragment.indexOf("?");
  const rawSearch = withoutFragment.startsWith("?")
    ? withoutFragment.slice(1)
    : queryIndex >= 0
      ? withoutFragment.slice(queryIndex + 1)
      : withoutFragment;
  const params = new URLSearchParams(rawSearch);

  for (const key of EXPLORER_KEYS) params.delete(key);

  if (query.text) params.set("q", query.text);
  if (query.kind) params.set("kind", query.kind);
  if (query.status) params.set("status", query.status);
  if (query.nuId) params.set("nu", query.nuId);
  if (query.category) params.set("category", query.category);
  if (query.sort !== "number") params.set("sort", query.sort);

  const serialized = params.toString();
  return `${serialized ? `?${serialized}` : ""}${fragment}`;
}

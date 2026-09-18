export function parseZipsQuery(search: string): {
  text: string;
  kind: "draft" | "numbered" | "";
} {
  const p = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const rawKind = p.get("kind") ?? "";
  const kind = rawKind === "draft" || rawKind === "numbered" ? rawKind : "";
  return { text: p.get("q") ?? "", kind };
}

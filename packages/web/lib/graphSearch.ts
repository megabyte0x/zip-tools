import type { GraphRecordNode } from "./graphFallback.ts";

export function findGraphNode(
  nodes: GraphRecordNode[],
  query: string,
): GraphRecordNode | undefined {
  const raw = query.trim().toLowerCase();
  if (!raw) return undefined;
  const numeric = raw.replace(/^zip\s+/, "");
  const asNumber = Number(numeric);
  if (Number.isInteger(asNumber)) {
    const byId = nodes.find((node) => node.id === asNumber);
    if (byId) return byId;
  }
  return nodes.find((node) => node.title.trim().toLowerCase() === raw);
}

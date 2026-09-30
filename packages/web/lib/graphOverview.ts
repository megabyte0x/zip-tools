import type { GraphRecords } from "./graphFallback.ts";

function citationDegree(node: GraphRecords["nodes"][number]): number {
  return node.citesCount + node.citedByCount;
}

function rankedAssignedNodes(data: GraphRecords) {
  return data.nodes
    .filter((node) => !node.unassigned && citationDegree(node) > 0)
    .sort((left, right) => citationDegree(right) - citationDegree(left) || left.id - right.id);
}

export function overviewGraphNodeIds(data: GraphRecords, limit = 24): Set<number> {
  const hubs = rankedAssignedNodes(data);
  if (hubs.length === 0) return new Set(data.nodes.map((node) => node.id));
  const count = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : hubs.length;
  return new Set(hubs.slice(0, count).map((node) => node.id));
}

export function featuredGraphLabelIds(data: GraphRecords, limit = 12): Set<number> {
  const count = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 12;
  return new Set(
    data.nodes
      .filter((node) => !node.unassigned)
      .sort((left, right) => citationDegree(right) - citationDegree(left) || left.id - right.id)
      .slice(0, count)
      .map((node) => node.id),
  );
}

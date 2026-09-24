import type { GraphRecordNode } from "./graphFallback.ts";

export const GRAPH_DETAILS_IDLE = "Hover or tap a node to see its title and citations.";

export function graphNodeLabel(node: Pick<GraphRecordNode, "id">): string {
  return String(node.id);
}

export function graphNodeHeading(node: Pick<GraphRecordNode, "id" | "title" | "unassigned">): string {
  return node.unassigned ? `${node.id} — Unassigned` : `ZIP ${node.id}: ${node.title}`;
}

export function graphNodeFacts(
  node: Pick<GraphRecordNode, "status" | "unassigned" | "citesCount" | "citedByCount">,
): string {
  return [
    ...(node.unassigned || !node.status ? [] : [node.status]),
    `Cites ${node.citesCount}`,
    `Cited by ${node.citedByCount}`,
  ].join(" · ");
}

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

export function graphTooltipHtml(node: GraphRecordNode): string {
  return `<strong>${escapeHtml(graphNodeHeading(node))}</strong><br><span>${escapeHtml(graphNodeFacts(node))}</span>`;
}

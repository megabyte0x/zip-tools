import type { ZipIndexFile, ZipRecord } from "./types";

export type GraphNode = { number: number; title: string; unassigned: boolean };
export type GraphEdge = { from: number; to: number };
export type Neighborhood = { nodes: GraphNode[]; edges: GraphEdge[] };

function addDirected(
  outbound: Map<number, Set<number>>,
  inbound: Map<number, Set<number>>,
  from: number,
  to: number,
): void {
  let outs = outbound.get(from);
  if (!outs) {
    outs = new Set();
    outbound.set(from, outs);
  }
  outs.add(to);

  let ins = inbound.get(to);
  if (!ins) {
    ins = new Set();
    inbound.set(to, ins);
  }
  ins.add(from);
}

function adjacency(index: ZipIndexFile): {
  outbound: Map<number, Set<number>>;
  inbound: Map<number, Set<number>>;
} {
  const outbound = new Map<number, Set<number>>();
  const inbound = new Map<number, Set<number>>();

  for (const zip of index.zips) {
    if (zip.number === null) continue;
    for (const cited of zip.citations) {
      addDirected(outbound, inbound, zip.number, cited);
    }
    for (const citer of zip.citedBy) {
      addDirected(outbound, inbound, citer, zip.number);
    }
  }

  return { outbound, inbound };
}

function nodeFor(byNumber: Map<number, ZipRecord>, number: number): GraphNode {
  const zip = byNumber.get(number);
  if (zip) {
    return { number, title: zip.title, unassigned: false };
  }
  return { number, title: "Unassigned", unassigned: true };
}

export function neighborhood(index: ZipIndexFile, number: number, depth: 1 | 2): Neighborhood {
  const byNumber = new Map<number, ZipRecord>();
  for (const zip of index.zips) {
    if (zip.number !== null) byNumber.set(zip.number, zip);
  }

  const { outbound, inbound } = adjacency(index);
  const nodeNums = new Set<number>([number]);
  const edgeKeys = new Set<string>();
  const edges: GraphEdge[] = [];

  let frontier = [number];
  for (let hop = 0; hop < depth; hop++) {
    const next: number[] = [];
    for (const n of frontier) {
      for (const to of outbound.get(n) ?? []) {
        const key = `${n}->${to}`;
        if (!edgeKeys.has(key)) {
          edgeKeys.add(key);
          edges.push({ from: n, to });
        }
        if (!nodeNums.has(to)) {
          nodeNums.add(to);
          next.push(to);
        }
      }
      for (const from of inbound.get(n) ?? []) {
        const key = `${from}->${n}`;
        if (!edgeKeys.has(key)) {
          edgeKeys.add(key);
          edges.push({ from, to: n });
        }
        if (!nodeNums.has(from)) {
          nodeNums.add(from);
          next.push(from);
        }
      }
    }
    frontier = next;
  }

  const nodes = [...nodeNums].map((n) => nodeFor(byNumber, n));
  nodes.sort((a, b) => a.number - b.number);
  edges.sort((a, b) => a.from - b.from || a.to - b.to);
  return { nodes, edges };
}

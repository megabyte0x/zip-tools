import type { ZipRecord } from "./types.ts";

export const GRAPH_HELP = "Drag to rotate, scroll to zoom, right-drag to pan. Click a node to open it.";
export const GRAPH_UNAVAILABLE = "Citation graph is unavailable in this browser.";

export type GraphRecordNode = {
  id: number;
  title: string;
  unassigned: boolean;
  status: string;
};

export type GraphRecordLink = { source: number; target: number };

export type GraphRecords = {
  nodes: GraphRecordNode[];
  links: GraphRecordLink[];
};

function primaryStatus(zip: ZipRecord): string {
  return zip.status[0]?.label ?? zip.statusRaw;
}

export function graphRecords(zips: ZipRecord[], dangling: number[]): GraphRecords {
  const nodes = new Map<number, GraphRecordNode>();
  const links: GraphRecordLink[] = [];
  const seen = new Set<string>();

  const cited = new Set<number>();
  for (const zip of zips) {
    if (zip.number === null) continue;
    nodes.set(zip.number, {
      id: zip.number,
      title: zip.title,
      unassigned: false,
      status: primaryStatus(zip),
    });
    for (const to of zip.citations) {
      if (to !== zip.number) cited.add(to);
    }
  }

  for (const id of dangling) {
    if (!nodes.has(id) && cited.has(id)) {
      nodes.set(id, { id, title: "Unassigned", unassigned: true, status: "" });
    }
  }

  for (const zip of zips) {
    if (zip.number === null) continue;
    for (const to of zip.citations) {
      if (to === zip.number || !nodes.has(to)) continue;
      const key = `${zip.number}->${to}`;
      if (seen.has(key)) continue;
      seen.add(key);
      links.push({ source: zip.number, target: to });
    }
  }

  return {
    nodes: [...nodes.values()].sort((a, b) => a.id - b.id),
    links,
  };
}

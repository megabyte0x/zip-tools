"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { filterZips } from "../lib/filter";
import type { GraphRecords } from "../lib/graphFallback";
import { neighborhood } from "../lib/neighborhood";
import type { GraphNode, Neighborhood } from "../lib/neighborhood";
import type { ZipIndexFile } from "../lib/types";
import { ForceGraph3D } from "./ForceGraph3D";
import styles from "./CitationGraph.module.css";

export type CitationGraphProps = {
  center?: number;
  depth1: Neighborhood;
};

function nodeHref(node: GraphNode): string {
  return `/zip/${node.number}`;
}

function NodeList({ nodes, empty }: { nodes: GraphNode[]; empty: string }) {
  if (nodes.length === 0) {
    return <p className={styles.empty}>{empty}</p>;
  }
  return (
    <ul className={styles.list}>
      {nodes.map((node) => (
        <li key={node.number} className={styles.item}>
          {node.unassigned ? (
            <span className={styles.unassignedText}>
              {node.number} — Unassigned
            </span>
          ) : (
            <Link className={styles.link} href={nodeHref(node)}>
              {node.number} — {node.title}
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

function graphRecordsFromNeighborhood(graph: Neighborhood): GraphRecords {
  const nodes = graph.nodes.map((node) => ({
    id: node.number,
    title: node.title,
    unassigned: node.unassigned,
    status: node.status ?? "",
    citesCount: 0,
    citedByCount: 0,
  }));
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const links = graph.edges.map((edge) => {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (from) from.citesCount += 1;
    if (to) to.citedByCount += 1;
    return { source: edge.from, target: edge.to };
  });
  return { nodes, links };
}

export function CitationGraph({ center, depth1 }: CitationGraphProps) {
  const graph = useMemo(() => graphRecordsFromNeighborhood(depth1), [depth1]);

  const cites = useMemo(() => {
    if (center == null) return [];
    const byNumber = new Map(depth1.nodes.map((node) => [node.number, node]));
    return depth1.edges
      .filter((edge) => edge.from === center)
      .map((edge) => byNumber.get(edge.to))
      .filter((node): node is GraphNode => Boolean(node));
  }, [center, depth1]);

  const citedBy = useMemo(() => {
    if (center == null) return [];
    const byNumber = new Map(depth1.nodes.map((node) => [node.number, node]));
    return depth1.edges
      .filter((edge) => edge.to === center)
      .map((edge) => byNumber.get(edge.from))
      .filter((node): node is GraphNode => Boolean(node));
  }, [center, depth1]);

  return (
    <section className={styles.wrap} aria-labelledby="citation-graph-heading">
      <div className={styles.header}>
        <h2 id="citation-graph-heading" className={styles.heading}>
          Citation graph
        </h2>
      </div>
      {center != null ? (
        <div className={styles.lists}>
          <div>
            <h3 className={styles.listHeading}>Cites</h3>
            <NodeList nodes={cites} empty="None" />
          </div>
          <div>
            <h3 className={styles.listHeading}>Cited by</h3>
            <NodeList nodes={citedBy} empty="None" />
          </div>
        </div>
      ) : (
        <div className={styles.lists}>
          <div>
            <h3 className={styles.listHeading}>ZIPs</h3>
            <NodeList nodes={depth1.nodes} empty="None" />
          </div>
        </div>
      )}
      <ForceGraph3D variant="detail" data={graph} />
    </section>
  );
}

function mergeNeighborhoods(parts: Neighborhood[]): Neighborhood {
  const nodes = new Map<number, GraphNode>();
  const edges = new Map<string, { from: number; to: number }>();
  for (const part of parts) {
    for (const node of part.nodes) nodes.set(node.number, node);
    for (const edge of part.edges) edges.set(`${edge.from}->${edge.to}`, edge);
  }
  return {
    nodes: [...nodes.values()].sort((a, b) => a.number - b.number),
    edges: [...edges.values()].sort((a, b) => a.from - b.from || a.to - b.to),
  };
}

export function GlobalCitationGraph({ index }: { index: ZipIndexFile }) {
  const [nuId, setNuId] = useState("");
  const nuIds = useMemo(
    () => [...new Set(index.zips.flatMap((zip) => zip.nuIds).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [index.zips],
  );
  const filtered = useMemo(
    () => filterZips(index.zips, { nuId: nuId || undefined }),
    [index.zips, nuId],
  );
  const graph = useMemo(() => {
    const parts = filtered
      .filter((zip) => zip.number !== null)
      .map((zip) => neighborhood(index, zip.number as number, 1));
    return mergeNeighborhoods(parts);
  }, [filtered, index]);

  return (
    <div>
      <label className={`${styles.depth} ${styles.filter}`}>
        NU
        <select
          className={styles.select}
          value={nuId}
          onChange={(event) => setNuId(event.target.value)}
        >
          <option value="">All</option>
          {nuIds.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </label>
      <CitationGraph depth1={graph} />
    </div>
  );
}

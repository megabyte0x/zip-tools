"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { GraphRecords } from "../lib/graphFallback";
import type { GraphNode, Neighborhood } from "../lib/neighborhood";
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

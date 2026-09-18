"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { filterZips } from "../lib/filter";
import { neighborhood } from "../lib/neighborhood";
import type { GraphNode, Neighborhood } from "../lib/neighborhood";
import type { ZipIndexFile } from "../lib/types";
import styles from "./CitationGraph.module.css";

export type CitationGraphProps = {
  center?: number;
  depth1: Neighborhood;
  depth2?: Neighborhood;
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

function columnPositions(nums: number[], x: number, cy: number, height: number): Map<number, { x: number; y: number }> {
  const pos = new Map<number, { x: number; y: number }>();
  const unique = [...new Set(nums)];
  unique.forEach((n, i) => {
    const y =
      unique.length === 1 ? cy : 36 + (i * (height - 72)) / Math.max(unique.length - 1, 1);
    pos.set(n, { x, y });
  });
  return pos;
}

function layoutNodes(
  graph: Neighborhood,
  center: number | undefined,
): Map<number, { x: number; y: number }> {
  const width = 640;
  const height = 360;
  const cx = width / 2;
  const cy = height / 2;
  const pos = new Map<number, { x: number; y: number }>();

  if (center == null) {
    const radius = Math.min(cx, cy) - 48;
    const count = Math.max(graph.nodes.length, 1);
    graph.nodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / count - Math.PI / 2;
      pos.set(node.number, {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      });
    });
    return pos;
  }

  pos.set(center, { x: cx, y: cy });
  const cites = graph.edges.filter((edge) => edge.from === center).map((edge) => edge.to);
  const citedBy = graph.edges.filter((edge) => edge.to === center).map((edge) => edge.from);
  for (const [n, p] of columnPositions(citedBy, 88, cy, height)) pos.set(n, p);
  for (const [n, p] of columnPositions(cites, 552, cy, height)) pos.set(n, p);

  const extras = graph.nodes
    .map((node) => node.number)
    .filter((n) => !pos.has(n));
  extras.forEach((n, i) => {
    pos.set(n, {
      x: 200 + (i % 3) * 120,
      y: 28 + Math.floor(i / 3) * 36,
    });
  });
  return pos;
}

function SvgGraph({ graph, center }: { graph: Neighborhood; center?: number }) {
  const positions = useMemo(() => {
    try {
      return layoutNodes(graph, center);
    } catch {
      return null;
    }
  }, [graph, center]);

  if (!positions) return null;

  return (
    <svg
      className={styles.svg}
      viewBox="0 0 640 360"
      role="img"
      aria-label="Citation neighborhood"
    >
      {graph.edges.map((edge) => {
        const from = positions.get(edge.from);
        const to = positions.get(edge.to);
        if (!from || !to) return null;
        return (
          <line
            key={`${edge.from}-${edge.to}`}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            className={styles.edge}
          />
        );
      })}
      {graph.nodes.map((node) => {
        const p = positions.get(node.number);
        if (!p) return null;
        const isCenter = node.number === center;
        const nodeClass = node.unassigned
          ? styles.danglingNode
          : isCenter
            ? styles.centerNode
            : styles.node;
        const label = node.unassigned ? `${node.number}` : String(node.number);
        const content = (
          <>
            <circle cx={p.x} cy={p.y} r={isCenter ? 16 : 12} className={nodeClass} />
            <text
              x={p.x}
              y={p.y + 4}
              textAnchor="middle"
              className={isCenter ? styles.centerLabel : styles.label}
            >
              {label}
            </text>
          </>
        );
        if (node.unassigned) {
          return <g key={node.number}>{content}</g>;
        }
        return (
          <a key={node.number} href={nodeHref(node)}>
            {content}
            <title>{node.title}</title>
          </a>
        );
      })}
    </svg>
  );
}

export function CitationGraph({ center, depth1, depth2 }: CitationGraphProps) {
  const [depth, setDepth] = useState<1 | 2>(1);
  const graph = depth === 2 && depth2 ? depth2 : depth1;

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
        {depth2 ? (
          <label className={styles.depth}>
            Depth
            <select
              className={styles.select}
              value={depth}
              onChange={(event) => setDepth(event.target.value === "2" ? 2 : 1)}
            >
              <option value="1">1</option>
              <option value="2">2</option>
            </select>
          </label>
        ) : null}
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
            <NodeList nodes={graph.nodes} empty="None" />
          </div>
        </div>
      )}
      <SvgGraph graph={graph} center={center} />
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

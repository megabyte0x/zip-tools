"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Component,
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ForceGraphMethods, NodeObject } from "react-force-graph-3d";
import { filterZips } from "../lib/filter";
import {
  GRAPH_HELP,
  GRAPH_UNAVAILABLE,
  graphRecords,
  type GraphRecordNode,
  type GraphRecords,
} from "../lib/graphFallback";
import { STATUS_LEGEND, statusColor } from "../lib/statusColor";
import type { ZipRecord } from "../lib/types";
import styles from "./ForceGraph3D.module.css";

const ForceGraphImpl = dynamic(() => import("react-force-graph-3d"), { ssr: false });

export type ForceGraph3DProps = {
  zips: ZipRecord[];
  dangling: number[];
  variant: "home" | "graph";
};

class GraphErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode; resetKey: number; onError?: () => void },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch() {
    this.props.onError?.();
  }

  componentDidUpdate(prevProps: Readonly<{ resetKey: number }>) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

function isGraphRuntimeError(error: unknown): boolean {
  const text =
    error instanceof Error
      ? `${error.name} ${error.message} ${error.stack ?? ""}`
      : String(error ?? "");
  return /webgl|three|force-graph|CONTEXT_LOST|WebGLRenderer/i.test(text);
}

function assertWebGl(): void {
  if (typeof document === "undefined") return;
  const canvas = document.createElement("canvas");
  const gl =
    canvas.getContext("webgl") ||
    canvas.getContext("webgl2") ||
    canvas.getContext("experimental-webgl");
  if (!gl) throw new Error("webgl");
}

function uniqueNumbers(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

function findNode(nodes: GraphRecordNode[], query: string): GraphRecordNode | undefined {
  const raw = query.trim().toLowerCase();
  if (!raw) return undefined;
  const numeric = raw.replace(/^zip\s+/, "");
  const asNum = Number(numeric);
  if (Number.isInteger(asNum)) {
    const byId = nodes.find((node) => node.id === asNum);
    if (byId) return byId;
  }
  return nodes.find((node) => node.title.toLowerCase().includes(raw));
}

function focusNode(fg: ForceGraphMethods | undefined, node: NodeObject<GraphRecordNode>) {
  if (!fg || node.x == null || node.y == null || node.z == null) return;
  const dist = 160;
  const hyp = Math.hypot(node.x, node.y, node.z) || 1;
  const ratio = 1 + dist / hyp;
  fg.cameraPosition(
    { x: node.x * ratio, y: node.y * ratio, z: node.z * ratio },
    { x: node.x, y: node.y, z: node.z },
    800,
  );
}

function zoomBy(fg: ForceGraphMethods | undefined, factor: number) {
  if (!fg) return;
  const cam = fg.camera();
  fg.cameraPosition(
    { x: cam.position.x * factor, y: cam.position.y * factor, z: cam.position.z * factor },
    { x: 0, y: 0, z: 0 },
    300,
  );
}

function NumberList({ ids, nodes }: { ids: number[]; nodes: GraphRecordNode[] }) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  if (ids.length === 0) return <p className={styles.empty}>None</p>;
  return (
    <ul className={styles.list}>
      {ids.map((id) => {
        const node = byId.get(id);
        const unassigned = node?.unassigned ?? true;
        return (
          <li key={id} className={styles.item}>
            {unassigned ? (
              <span className={styles.muted}>{id}</span>
            ) : (
              <Link className={styles.link} href={`/zip/${id}`}>
                {id}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Fallback({
  data,
  variant,
  onRetry,
}: {
  data: GraphRecords;
  variant: "home" | "graph";
  onRetry: () => void;
}) {
  const cites = uniqueNumbers(data.links.map((link) => link.target));
  const citedBy = uniqueNumbers(data.links.map((link) => link.source));
  return (
    <div className={`${styles.fallback}${variant === "graph" ? ` ${styles.pageFallback}` : ""}`}>
      <p className={styles.unavailable}>{GRAPH_UNAVAILABLE}</p>
      <div className={styles.lists}>
        <div>
          <h3 className={styles.listHeading}>Cites</h3>
          <NumberList ids={cites} nodes={data.nodes} />
        </div>
        <div>
          <h3 className={styles.listHeading}>Cited by</h3>
          <NumberList ids={citedBy} nodes={data.nodes} />
        </div>
      </div>
      <div className={styles.actions}>
        <button className={styles.button} type="button" onClick={onRetry}>
          Try again
        </button>
        <Link className={styles.button} href="/zips">
          Browse ZIPs
        </Link>
        {variant === "graph" ? (
          <Link className={styles.button} href="/">
            Home
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function GraphCanvas({
  data,
  heightClass,
  fill,
  onRuntimeError,
}: {
  data: GraphRecords;
  heightClass: string;
  fill: boolean;
  onRuntimeError: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);
  const router = useRouter();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [query, setQuery] = useState("");

  assertWebGl();

  const graphData = useMemo(
    () => ({
      nodes: data.nodes.map((node) => ({ ...node })),
      links: data.links.map((link) => ({ ...link })),
    }),
    [data],
  );

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const sync = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      const fromFile = /webgl|three|force-graph/i.test(event.filename ?? "");
      if (fromFile || isGraphRuntimeError(event.error ?? event.message)) onRuntimeError();
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      if (isGraphRuntimeError(event.reason)) onRuntimeError();
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [onRuntimeError]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onLost = (event: Event) => {
      event.preventDefault();
      onRuntimeError();
    };
    el.addEventListener("webglcontextlost", onLost, true);
    return () => el.removeEventListener("webglcontextlost", onLost, true);
  }, [onRuntimeError, size.width, size.height]);

  function onSearch(event: FormEvent) {
    event.preventDefault();
    const node = findNode(graphData.nodes, query);
    if (node) focusNode(fgRef.current, node);
  }

  return (
    <div className={fill ? styles.graphBody : undefined}>
      <div className={styles.toolbar}>
        <form className={styles.searchForm} onSubmit={onSearch}>
          <label className={styles.filter}>
            Search
            <input
              className={styles.search}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ZIP number or title"
            />
          </label>
          <button className={styles.button} type="submit">
            Focus
          </button>
        </form>
        <button className={styles.button} type="button" onClick={() => zoomBy(fgRef.current, 0.8)}>
          Zoom in
        </button>
        <button className={styles.button} type="button" onClick={() => zoomBy(fgRef.current, 1.25)}>
          Zoom out
        </button>
        <button
          className={styles.button}
          type="button"
          onClick={() => fgRef.current?.zoomToFit(400, 40)}
        >
          Reset
        </button>
      </div>
      <div ref={wrapRef} className={`${styles.canvas} ${heightClass}`}>
        {size.width > 0 && size.height > 0 ? (
          <ForceGraphImpl
            ref={fgRef}
            width={size.width}
            height={size.height}
            graphData={graphData}
            backgroundColor="#141613"
            showNavInfo={false}
            nodeLabel={(node) =>
              node.unassigned ? `${node.id} — Unassigned` : `ZIP ${node.id}: ${node.title}`
            }
            nodeColor={(node) => (node.unassigned ? "#a3a091" : statusColor(node.status))}
            linkColor={() => "rgba(244, 241, 232, 0.28)"}
            onNodeClick={(node) => {
              if (!node.unassigned && node.id != null) router.push(`/zip/${node.id}`);
            }}
            showPointerCursor={(obj) => Boolean(obj && "unassigned" in obj && !obj.unassigned)}
          />
        ) : null}
      </div>
    </div>
  );
}

export function ForceGraph3D({ zips, dangling, variant }: ForceGraph3DProps) {
  const [nuId, setNuId] = useState("");
  const [retry, setRetry] = useState(0);
  const [failed, setFailed] = useState(false);
  const nuIds = useMemo(
    () => [...new Set(zips.flatMap((zip) => zip.nuIds).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [zips],
  );
  const filtered = useMemo(
    () => (variant === "graph" ? filterZips(zips, { nuId: nuId || undefined }) : zips),
    [variant, zips, nuId],
  );
  const data = useMemo(() => graphRecords(filtered, dangling), [filtered, dangling]);
  const Heading = variant === "graph" ? "h1" : "h2";
  const onRetry = () => {
    setFailed(false);
    setRetry((n) => n + 1);
  };
  const onRuntimeError = () => setFailed(true);
  const fallback = <Fallback data={data} variant={variant} onRetry={onRetry} />;

  return (
    <section
      className={`${styles.section}${variant === "graph" ? ` ${styles.page}` : ""}`}
      aria-labelledby="citation-graph-3d-heading"
    >
      <div className={styles.header}>
        <Heading id="citation-graph-3d-heading" className={styles.heading}>
          Citation graph
        </Heading>
        {variant === "home" ? (
          <Link className={styles.link} href="/graph">
            Full graph
          </Link>
        ) : null}
      </div>
      <p className={styles.help}>{GRAPH_HELP}</p>
      {variant === "graph" ? (
        <label className={styles.filter}>
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
      ) : null}
      <ul className={styles.legend}>
        {STATUS_LEGEND.map((label) => (
          <li key={label} className={styles.legendItem}>
            <span className={styles.swatch} style={{ background: statusColor(label) }} />
            {label}
          </li>
        ))}
      </ul>
      {failed ? (
        fallback
      ) : (
        <GraphErrorBoundary resetKey={retry} fallback={fallback} onError={onRuntimeError}>
          <GraphCanvas
            key={retry}
            data={data}
            fill={variant === "graph"}
            heightClass={variant === "home" ? styles.preview : styles.full}
            onRuntimeError={onRuntimeError}
          />
        </GraphErrorBoundary>
      )}
    </section>
  );
}

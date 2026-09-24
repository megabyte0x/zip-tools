"use client";

import dynamic from "next/dynamic";
import { Minus, Plus, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Component,
  type FormEvent,
  type ReactNode,
  useCallback,
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
import { findGraphNode } from "../lib/graphSearch";
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
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

function isGraphRuntimeError(error: unknown): boolean {
  const text =
    error instanceof Error
      ? `${error.name} ${error.message} ${error.stack ?? ""}`
      : String(error ?? "");
  return /webgl|three|force-graph|CONTEXT_LOST|WebGLRenderer/i.test(text);
}

function focusNode(
  fg: ForceGraphMethods | undefined,
  node: NodeObject<GraphRecordNode>,
  reducedMotion: boolean,
) {
  if (!fg) return;
  if (node.x == null || node.y == null || node.z == null) {
    fg.zoomToFit(reducedMotion ? 0 : 800, 160, (candidate) => candidate.id === node.id);
    return;
  }
  const distance = 160;
  const hypotenuse = Math.hypot(node.x, node.y, node.z) || 1;
  const ratio = 1 + distance / hypotenuse;
  fg.cameraPosition(
    { x: node.x * ratio, y: node.y * ratio, z: node.z * ratio },
    { x: node.x, y: node.y, z: node.z },
    reducedMotion ? 0 : 800,
  );
}

function zoomBy(fg: ForceGraphMethods | undefined, factor: number, reducedMotion: boolean) {
  if (!fg) return;
  const camera = fg.camera();
  fg.cameraPosition(
    {
      x: camera.position.x * factor,
      y: camera.position.y * factor,
      z: camera.position.z * factor,
    },
    { x: 0, y: 0, z: 0 },
    reducedMotion ? 0 : 300,
  );
}

function Fallback({ variant, onRetry }: { variant: "home" | "graph"; onRetry: () => void }) {
  return (
    <div
      className={`${styles.fallback}${variant === "graph" ? ` ${styles.pageFallback}` : ""}`}
      data-testid="graph-surface"
      data-state="failed"
    >
      <p className={styles.unavailable}>{GRAPH_UNAVAILABLE}</p>
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

function EmptyGraph({ variant }: { variant: "home" | "graph" }) {
  return (
    <div
      className={`${styles.emptyState}${variant === "graph" ? ` ${styles.pageFallback}` : ""}`}
      data-testid="graph-surface"
      data-state="empty"
    >
      <h3>No citation nodes</h3>
      <p>{variant === "graph" ? "No citation nodes match this network upgrade." : "No citation nodes are available."}</p>
      <Link className={styles.button} href="/zips">
        Browse ZIPs
      </Link>
    </div>
  );
}

function GraphCanvas({
  data,
  heightClass,
  fill,
  variant,
  onRuntimeError,
}: {
  data: GraphRecords;
  heightClass: string;
  fill: boolean;
  variant: "home" | "graph";
  onRuntimeError: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);
  const router = useRouter();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [query, setQuery] = useState("");
  const [feedback, setFeedback] = useState("");
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [cameraAction, setCameraAction] = useState("initial");

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const testWindow = window as Window & {
      __ZIP_TEST_GRAPH_CAMERA__?: () => [number, number, number];
      __ZIP_TEST_GRAPH_VISIBLE_LINKS__?: () => number;
    };
    const observe = (): [number, number, number] => {
      const position = fgRef.current?.camera().position;
      if (!position) throw new Error("Graph camera is not initialized");
      return [position.x, position.y, position.z];
    };
    const observeVisibleLinks = () => {
      const scene = fgRef.current?.scene();
      if (!scene) throw new Error("Graph scene is not initialized");
      let visibleLinks = 0;
      scene.traverse((object) => {
        const link = object as typeof object & {
          __graphObjType?: string;
          material?: { opacity?: number; visible?: boolean } | Array<{ opacity?: number; visible?: boolean }>;
        };
        if (link.__graphObjType !== "link") return;
        for (let current: typeof object | null = object; current; current = current.parent) {
          if (!current.visible) return;
        }
        const materials = Array.isArray(link.material) ? link.material : [link.material];
        if (materials.some((material) => material && material.visible !== false && (material.opacity ?? 1) > 0)) {
          visibleLinks += 1;
        }
      });
      return visibleLinks;
    };
    testWindow.__ZIP_TEST_GRAPH_CAMERA__ = observe;
    testWindow.__ZIP_TEST_GRAPH_VISIBLE_LINKS__ = observeVisibleLinks;
    return () => {
      if (testWindow.__ZIP_TEST_GRAPH_CAMERA__ === observe) delete testWindow.__ZIP_TEST_GRAPH_CAMERA__;
      if (testWindow.__ZIP_TEST_GRAPH_VISIBLE_LINKS__ === observeVisibleLinks) {
        delete testWindow.__ZIP_TEST_GRAPH_VISIBLE_LINKS__;
      }
    };
  }, []);

  const graphData = useMemo(
    () => ({
      nodes: data.nodes.map((node) => ({ ...node })),
      links: data.links.map((link) => ({ ...link })),
    }),
    [data],
  );

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarse = window.matchMedia("(pointer: coarse)");
    const sync = () => {
      setReducedMotion(reduced.matches);
      if (variant === "home" && coarse.matches) setActive(false);
    };
    sync();
    reduced.addEventListener("change", sync);
    coarse.addEventListener("change", sync);
    return () => {
      reduced.removeEventListener("change", sync);
      coarse.removeEventListener("change", sync);
    };
  }, [variant]);

  useEffect(() => {
    const element = wrapRef.current;
    if (!element) return;
    const sync = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = wrapRef.current;
    if (!element) return;
    const handleLost = (event: Event) => {
      event.preventDefault();
      onRuntimeError();
    };
    let canvas: HTMLCanvasElement | null = null;
    const attach = () => {
      const next = element.querySelector("canvas");
      if (next === canvas) return;
      canvas?.removeEventListener("webglcontextlost", handleLost);
      canvas = next;
      canvas?.addEventListener("webglcontextlost", handleLost);
    };
    attach();
    const observer = new MutationObserver(attach);
    observer.observe(element, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      canvas?.removeEventListener("webglcontextlost", handleLost);
    };
  }, [onRuntimeError]);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const fromGraphFile = /webgl|three|force-graph/i.test(event.filename ?? "");
      if (fromGraphFile || isGraphRuntimeError(event.error ?? event.message)) onRuntimeError();
    };
    const handleRejection = (event: PromiseRejectionEvent) => {
      if (isGraphRuntimeError(event.reason)) onRuntimeError();
    };
    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, [onRuntimeError]);

  useEffect(() => {
    const element = wrapRef.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) fgRef.current?.resumeAnimation();
      else fgRef.current?.pauseAnimation();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ready]);

  useEffect(() => {
    if (variant !== "home" || !active) return;
    const exit = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActive(false);
    };
    window.addEventListener("keydown", exit);
    return () => window.removeEventListener("keydown", exit);
  }, [active, variant]);

  function onSearch(event: FormEvent) {
    event.preventDefault();
    const node = findGraphNode(graphData.nodes, query);
    if (!node) {
      setFeedback(`No graph node matches "${query.trim()}".`);
      return;
    }
    const positionedNode = node as NodeObject<GraphRecordNode>;
    focusNode(fgRef.current, positionedNode, reducedMotion);
    setCameraAction(`focus-${node.id}`);
    setFeedback(node.unassigned ? `Focused ${node.id}: Unassigned.` : `Focused ZIP ${node.id}: ${node.title}.`);
  }

  const markReady = useCallback(() => setReady(true), []);

  return (
    <div
      className={fill ? styles.graphBody : undefined}
      data-testid="graph-surface"
      data-state={ready ? "ready" : "loading"}
      data-camera-action={cameraAction}
    >
      <div className={styles.toolbar}>
        <form className={styles.searchForm} onSubmit={onSearch}>
          <input
            aria-label="Search"
            className={styles.search}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a ZIP by number or title"
          />
          <button className={styles.button} type="submit">
            Focus
          </button>
        </form>
        {variant === "home" ? (
          <button
            className={`${styles.button} ${active ? "" : styles.primary}`}
            type="button"
            aria-pressed={active}
            onClick={() => setActive((value) => !value)}
          >
            {active ? "Done exploring" : "Explore graph"}
          </button>
        ) : null}
      </div>
      <p className={styles.statusLine}>
        <span className={styles.graphStatus} aria-live="polite" role="status">
          {feedback || (ready ? "Graph ready" : "Loading citation graph…")}
        </span>
        <span className={styles.counts}>{data.nodes.length} nodes · {data.links.length} citations</span>
      </p>
      <div
        ref={wrapRef}
        className={`${styles.canvas} ${heightClass}${active ? "" : ` ${styles.inactive}`}`}
        aria-label="Interactive 3D citation graph"
      >
        {!ready ? <span className={styles.loading}>Loading citation graph…</span> : null}
        <div className={styles.canvasControls}>
          <button
            className={styles.iconButton}
            type="button"
            aria-label="Zoom in"
            title="Zoom in"
            onClick={() => {
              zoomBy(fgRef.current, 0.8, reducedMotion);
              setCameraAction("zoom-in");
            }}
          >
            <Plus aria-hidden="true" />
          </button>
          <button
            className={styles.iconButton}
            type="button"
            aria-label="Zoom out"
            title="Zoom out"
            onClick={() => {
              zoomBy(fgRef.current, 1.25, reducedMotion);
              setCameraAction("zoom-out");
            }}
          >
            <Minus aria-hidden="true" />
          </button>
          <button
            className={styles.iconButton}
            type="button"
            aria-label="Reset"
            title="Reset view"
            onClick={() => {
              fgRef.current?.zoomToFit(reducedMotion ? 0 : 400, 40);
              setCameraAction("reset");
            }}
          >
            <RotateCcw aria-hidden="true" />
          </button>
        </div>
        {size.width > 0 && size.height > 0 ? (
          <ForceGraphImpl
            ref={fgRef}
            width={size.width}
            height={size.height}
            graphData={graphData}
            backgroundColor="#101210"
            showNavInfo={false}
            nodeLabel={(node) =>
              node.unassigned ? `${node.id} — Unassigned` : `ZIP ${node.id}: ${node.title}`
            }
            nodeColor={(node) => (node.unassigned ? "#a3a091" : statusColor(node.status))}
            nodeRelSize={5}
            linkColor={() => "rgba(244, 241, 232, 0.22)"}
            linkWidth={0.8}
            enableNavigationControls={active}
            enablePointerInteraction={active}
            cooldownTicks={reducedMotion ? 1 : undefined}
            onEngineTick={markReady}
            onEngineStop={markReady}
            onNodeClick={(node) => {
              if (!node.unassigned && node.id != null) router.push(`/zip/${node.id}`);
            }}
            showPointerCursor={(object) => Boolean(object && "unassigned" in object && !object.unassigned)}
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
    setRetry((value) => value + 1);
  };
  const onRuntimeError = useCallback(() => setFailed(true), []);
  const fallback = <Fallback variant={variant} onRetry={onRetry} />;

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
      <div className={styles.filters}>
        {variant === "graph" ? (
          <label className={styles.filter}>
            NU
            <select className={styles.select} value={nuId} onChange={(event) => setNuId(event.target.value)}>
              <option value="">All upgrades</option>
              {nuIds.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <ul className={styles.legend} aria-label="Status colours">
          {STATUS_LEGEND.map((label) => (
            <li key={label} className={styles.legendItem}>
              <span className={styles.swatch} style={{ background: statusColor(label) }} />
              {label}
            </li>
          ))}
        </ul>
      </div>
      {data.nodes.length === 0 ? (
        <EmptyGraph variant={variant} />
      ) : failed ? (
        fallback
      ) : (
        <GraphErrorBoundary resetKey={retry} fallback={fallback} onError={onRuntimeError}>
          <GraphCanvas
            key={retry}
            data={data}
            fill={variant === "graph"}
            variant={variant}
            heightClass={variant === "home" ? styles.preview : styles.full}
            onRuntimeError={onRuntimeError}
          />
        </GraphErrorBoundary>
      )}
    </section>
  );
}

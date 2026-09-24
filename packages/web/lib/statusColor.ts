const FALLBACK = "#a3a091";

/**
 * One hue per status, so the graph and pills read at a glance on the dark canvas.
 * Every pair is at least CIE76 dE 25 apart and every colour clears 3:1 on #141613
 * (see statusColor.test.ts).
 */
const STATUS_HEX: Record<string, string> = {
  Draft: "#6ea6f5",
  Proposed: "#e8b04a",
  Active: "#3fc9b0",
  Final: "#86d17a",
  Withdrawn: "#b3b0a6",
  Rejected: "#ef6f62",
  Obsolete: "#8f6a4a",
  Reserved: "#c58cf0",
};

export const STATUS_LEGEND = [
  "Draft",
  "Proposed",
  "Active",
  "Final",
  "Withdrawn",
  "Rejected",
  "Obsolete",
  "Reserved",
] as const;

export function statusColor(label: string): string {
  return STATUS_HEX[label] ?? FALLBACK;
}

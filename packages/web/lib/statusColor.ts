const TOKEN = {
  surface: "#141613",
  mutedSurface: "#1c1e19",
  fg: "#f4f1e8",
  muted: "#a3a091",
  accent: "#c4a35a",
} as const;

/** Distinct hex drawn from (or interpolated between) `lib/tokens.css` colors. */
const STATUS_HEX: Record<string, string> = {
  Draft: "#d4c9a3",
  Proposed: "#b7a06a",
  Active: TOKEN.accent,
  Final: TOKEN.fg,
  Withdrawn: "#6e6c62",
  Rejected: "#5c4a32",
  Obsolete: TOKEN.mutedSurface,
  Reserved: TOKEN.surface,
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
  return STATUS_HEX[label] ?? TOKEN.muted;
}

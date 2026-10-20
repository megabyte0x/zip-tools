/** @jsxRuntime automatic */
/** @jsxImportSource react */
import { ImageResponse } from "next/og";
import { statusColor } from "./statusColor";
import type { ZipRecord } from "./types";
import { SITE_NAME } from "./pageMetadata";
import { SITE_URL } from "./siteInfo";

export const OG_SIZE = { width: 1200, height: 630 };

/** Social preview card naming one proposal, its status, and its owners. */
export type OgFont = { name: string; data: ArrayBuffer; weight: 400 | 600; style: "normal" };

/** The homepage and non-proposal pages share the site's editorial branding. */
export function siteOgImage(fonts: OgFont[]): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 80px",
          background: "linear-gradient(180deg, #171a14 0%, #0a0b0a 100%)",
          color: "#f4f1e8",
          fontFamily: "IBM Plex Sans",
        }}
      >
        <div style={{ display: "flex", fontSize: 36, fontWeight: 600, color: "#c4a35a" }}>{SITE_NAME}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ display: "flex", fontFamily: "IBM Plex Serif", fontWeight: 600, fontSize: 80, lineHeight: 1.12 }}>
            Zcash Improvement Proposals
          </div>
          <div style={{ display: "flex", fontSize: 32, color: "#a3a091" }}>Read. Search. Follow citations.</div>
        </div>
        <div style={{ display: "flex", borderTop: "1px solid #665735", paddingTop: 22, fontSize: 28, color: "#c4a35a" }}>
          {new URL(SITE_URL).hostname}
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts },
  );
}

export function zipOgImage(zip: ZipRecord, fonts: OgFont[] = []): ImageResponse {
  const serif = fonts.some((font) => font.name === "IBM Plex Serif") ? "IBM Plex Serif" : undefined;
  const sans = fonts.some((font) => font.name === "IBM Plex Sans") ? "IBM Plex Sans" : undefined;
  const labels = [...new Set(zip.status.map((entry) => entry.label))].slice(0, 3);
  const kicker = zip.number != null ? `ZIP ${zip.number}` : "Draft ZIP";
  const owners = zip.owners.map((owner) => owner.name).join(", ");
  const title = zip.title.length > 110 ? `${zip.title.slice(0, 109).trimEnd()}…` : zip.title;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "linear-gradient(180deg, #171a14 0%, #0a0b0a 100%)",
          color: "#f4f1e8",
          fontFamily: sans,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ display: "flex", fontSize: 34, letterSpacing: 4, color: "#c4a35a", fontWeight: 600 }}>
            {kicker.toUpperCase()}
          </div>
          <div style={{ display: "flex", fontFamily: serif, fontSize: title.length > 60 ? 58 : 72, lineHeight: 1.12, fontWeight: 600 }}>
            {title}
          </div>
          <div style={{ display: "flex", gap: 14 }}>
            {labels.map((label) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  fontSize: 28,
                  padding: "8px 22px",
                  borderRadius: 999,
                  border: `2px solid ${statusColor(label)}`,
                  color: statusColor(label),
                }}
              >
                <div style={{ width: 14, height: 14, borderRadius: 999, background: statusColor(label) }} />
                {label}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", fontSize: 26, color: "#a3a091" }}>
          <div style={{ display: "flex", maxWidth: 760 }}>{owners}</div>
          <div style={{ display: "flex", color: "#f4f1e8", fontWeight: 600 }}>{SITE_NAME}</div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts },
  );
}

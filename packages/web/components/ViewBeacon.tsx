"use client";

import { useEffect } from "react";

export function ViewBeacon({ id }: { id: string }) {
  useEffect(() => {
    void fetch("/api/views", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {});
  }, [id]);
  return null;
}

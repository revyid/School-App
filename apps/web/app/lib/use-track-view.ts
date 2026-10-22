"use client";

// Pelacak view: kirim 1 event per konten per identitas (server throttel 15 mnt).
// Ringan: fire-and-forget, gagal diam-diam.
import { useEffect } from "react";

export function useTrackView(kind: "BOOK" | "PORTAL" | "MATERIAL" | "TASK" | "ANNOUNCEMENT", entityId: string) {
  useEffect(() => {
    if (!entityId) return;
    const body = JSON.stringify({ kind, entityId });
    void fetch("/api/track/view", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  }, [kind, entityId]);
}

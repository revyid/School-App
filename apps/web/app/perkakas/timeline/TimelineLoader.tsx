"use client";

import dynamic from "next/dynamic";

const TimelineClient = dynamic(() => import("./TimelineClient"), {
  ssr: false,
  loading: () => <p style={{ padding: 40, textAlign: "center", color: "#74746d" }}>Memuat generator timeline…</p>,
});

export default function TimelineLoader() {
  return <TimelineClient />;
}

"use client";

// Peta Leaflet + OpenStreetMap (client-only via dynamic ssr:false).
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const CUSTOM_MARKER_ICON = L.divIcon({
  className: "custom-leaflet-marker",
  html: `<div style="
    width: 24px;
    height: 24px;
    background: #e85e43;
    border: 3px solid #fffdf8;
    border-radius: 50%;
    box-shadow: 0 4px 10px rgba(23,23,22,0.4);
    transform: translate(-50%, -50%);
  "></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

export default function Map({ lat, lng }: { lat?: number | null; lng?: number | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const isValid = lat != null && lng != null && lat !== 0 && lng !== 0 && !isNaN(lat) && !isNaN(lng);

  useEffect(() => {
    if (!isValid || !ref.current) return;
    const map = L.map(ref.current).setView([lat, lng], 15);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);
    L.marker([lat, lng], { icon: CUSTOM_MARKER_ICON }).addTo(map);
    return () => {
      map.remove();
    };
  }, [isValid, lat, lng]);

  if (!isValid) return null;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div ref={ref} style={{ height: 320, width: "100%", maxWidth: 640, borderRadius: 16, overflow: "hidden", position: "relative", zIndex: 1 }} />
      <div>
        <a
          href={`https://www.google.com/maps?q=${lat},${lng}`}
          target="_blank"
          rel="noreferrer"
          className="btn-sticker btn-ghost"
          style={{ textDecoration: "none", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          Buka di Google Maps ↗
        </a>
      </div>
    </div>
  );
}

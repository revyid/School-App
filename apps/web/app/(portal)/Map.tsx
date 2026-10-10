"use client";

// Peta Leaflet + OpenStreetMap (client-only via dynamic ssr:false).
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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
    L.marker([lat, lng]).addTo(map);
    return () => {
      map.remove();
    };
  }, [isValid, lat, lng]);

  if (!isValid) return null;

  return <div ref={ref} style={{ height: 300, width: "100%", maxWidth: 640 }} />;
}

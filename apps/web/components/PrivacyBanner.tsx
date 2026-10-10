"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function PrivacyBanner() {
  const [accepted, setAccepted] = useState(true);

  useEffect(() => {
    const isOk = localStorage.getItem("sms-pdp-consent");
    if (!isOk) setAccepted(false);
  }, []);

  if (accepted) return null;

  function setujui() {
    localStorage.setItem("sms-pdp-consent", "1");
    setAccepted(true);
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        right: 16,
        left: 16,
        maxWidth: 540,
        margin: "0 auto",
        zIndex: 9999,
        background: "#fffdf8",
        color: "#171716",
        border: "2px solid #171716",
        borderRadius: 20,
        padding: "16px 20px",
        boxShadow: "0 12px 36px rgba(23,23,22,.2)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 18 }}>🛡️</span>
        <strong style={{ fontSize: 14, letterSpacing: "-0.01em" }}>
          Persetujuan Data Pribadi (UU PDP No. 27/2022)
        </strong>
      </div>
      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: "#575752" }}>
        Aplikasi ini memproses data pendidikan (presensi, tugas, nilai) secara aman untuk keperluan sekolah. Data Anda tidak dijual atau dibagikan ke pihak luar.
      </p>
      <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "flex-end" }}>
        <button
          onClick={setujui}
          className="btn-sticker btn-primary"
          style={{ padding: "6px 16px", fontSize: 12, textDecoration: "none" }}
        >
          Saya Mengerti & Setuju
        </button>
      </div>
    </div>
  );
}

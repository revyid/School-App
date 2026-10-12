"use client";

// Hook kamera bersama untuk SEMUA halaman yang butuh getUserMedia
// (scanner QR guru, foto izin siswa, dan capture lain di masa depan).
//
// Kenapa perlu: getUserMedia hanya tersedia di "secure context" (HTTPS atau
// localhost). Di jaringan biasa (http://192.168.x.x) API-nya benar-benar
// tidak ada, sehingga pesar error sebelumnya ("kamera tidak tersedia di semua
// device") muncul. Hook ini:
//   1. mendeteksi penyebab sebenarnya dan memberi pesan yang bisa ditindak;
//   2. mencoba beberapa constraints (environment -> user -> apa saja);
//   3. memastikan elemen <video> benar-benar play (autoplay dicekal di
//      beberapa browser sampai ada atribut playsInline + muted);
//   4. membersihkan stream saat unmount agar lampu kamera tidak menyala terus.

import { useCallback, useEffect, useRef, useState } from "react";

export type CameraError = {
  code: "insecure" | "unsupported" | "denied" | "notfound" | "busy" | "unknown";
  message: string;
};

/** True bila browser mengizinkan getUserMedia (HTTPS / localhost / file). */
export function isSecureForCamera(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.isSecureContext);
}

/** True bila API getUserMedia ada sama sekali. */
export function cameraApiExists(): boolean {
  if (typeof navigator === "undefined") return false;
  return Boolean(navigator.mediaDevices?.getUserMedia);
}

function classify(err: unknown): CameraError {
  const name = (err as { name?: string })?.name ?? "";
  const msg = (err as { message?: string })?.message ?? "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return {
        code: "denied",
        message:
          "Izin kamera ditolak. Buka menu kunci/gembok di bilah alamat, lalu izinkan Kamera untuk situs ini, kemudian coba lagi.",
      };
    case "NotFoundError":
    case "DevicesNotFoundError":
      return { code: "notfound", message: "Perangkat tidak punya kamera yang terdeteksi. Gunakan opsi input manual." };
    case "NotReadableError":
    case "TrackStartError":
      return { code: "busy", message: "Kamera sedang dipakai aplikasi lain. Tutup aplikasi kamera lain lalu coba lagi." };
    case "OverconstrainedError":
      return { code: "notfound", message: "Mode kamera yang diminta tidak tersedia. Coba ganti kamera depan/belakang." };
    default:
      if (/insecure|not supported|undefined/i.test(msg)) {
        return { code: "unsupported", message: "Browser ini tidak mendukung pengambilan kamera. Gunakan opsi input manual." };
      }
      return { code: "unknown", message: `Kamera gagal dibuka (${name || "error"}). Coba lagi atau gunakan input manual.` };
  }
}

export function useCamera(prefer: "environment" | "user" = "environment") {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<CameraError | null>(null);

  const stop = useCallback(() => {
    const v = videoRef.current;
    const stream = v?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (v) v.srcObject = null;
    setStreaming(false);
  }, []);

  const start = useCallback(async () => {
    if (starting || streaming) return false;
    setError(null);
    setStarting(true);

    if (!isSecureForCamera()) {
      setStarting(false);
      setError({
        code: "insecure",
        message:
          "Kamera hanya bisa dibuka lewat HTTPS atau localhost. Halaman ini dibuka tanpa koneksi aman, jadi browser memblokir kamera. Gunakan tautan https:// atau opsi input manual.",
      });
      return false;
    }
    if (!cameraApiExists()) {
      setStarting(false);
      setError({
        code: "unsupported",
        message: "Browser ini tidak mendukung getUserMedia (kamera). Gunakan browser Chrome/Edge/Safari terbaru atau input manual.",
      });
      return false;
    }

    // Coba bertingkat: ideal (facingMode) -> kamera apa saja.
    const attempts: MediaStreamConstraints[] = [
      { video: { facingMode: prefer, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
      { video: { facingMode: prefer }, audio: false },
      { video: true, audio: false },
    ];

    let lastErr: unknown = null;
    for (const constraints of attempts) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        const v = videoRef.current;
        if (v) {
          // playsInline + muted wajib agar iOS/Android tidak mencekal autoplay.
          v.setAttribute("playsinline", "");
          v.muted = true;
          v.srcObject = stream;
          try {
            await v.play();
          } catch {
            // Beberapa browser menolak play() otomatis; stream tetap terpasang.
          }
        }
        setStreaming(true);
        setStarting(false);
        return true;
      } catch (e) {
        lastErr = e;
      }
    }
    setStarting(false);
    const c = classify(lastErr);
    setError(c);
    return false;
  }, [prefer, starting, streaming]);

  // Pastikan stream dimatikan saat komponen dibongkar.
  useEffect(() => {
    return () => {
      const v = videoRef.current;
      const stream = v?.srcObject as MediaStream | null;
      stream?.getTracks().forEach((t) => t.stop());
      if (v) v.srcObject = null;
    };
  }, []);

  return { videoRef, streaming, starting, error, start, stop, setError };
}

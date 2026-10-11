"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

// Scroll reveal via IntersectionObserver (sekali tampil, lalu lepas).
//
// Kenapa ada "jaring pengaman" (fallback): pada navigasi sisi-klien (App Router)
// elemen kadang sudah berada di viewport saat observer dipasang namun callback
// tidak pernah dipanggil (atau dipanggil sebelum layout stabil), sehingga konten
// berubah dari tampil -> sembunyi dan baru muncul lagi setelah reload halaman.
// Dua pengaman dipakai:
//   1. fallback timer yang memaksa elemen tampil setelah 900ms;
//   2. pathname: begitu rute berganti, elemen dipaksa tampil (reveal ulang).
//
// Selain itu prefers-reduced-motion dan kondisi tanpa observer membuat elemen
// SELALU tampil — konten tidak pernah hilang hanya karena JS.
export default function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const show = () => {
      el.style.transitionDelay = `${delay}ms`;
      el.classList.add("is-visible");
    };

    // Pengaman 1: hormati preferensi pengguna, jangan sembunyikan apa pun.
    if (reduced || !("IntersectionObserver" in window)) {
      setHidden(false);
      el.classList.add("is-visible");
      return;
    }

    setHidden(true);

    // Pengaman 2: paksa tampil paling lambat 900ms sejak mount / ganti rute.
    const failsafe = window.setTimeout(show, 900);

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            show();
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.01, rootMargin: "0px 0px -40px 0px" },
    );
    io.observe(el);

    // Pengaman 3: kalau observer belum juga memicu (layout belum stabil karena
    // font/gambar), periksa ulang sekali lagi setelah dua frame.
    const raf = window.setTimeout(() => {
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) {
        show();
        io.disconnect();
      }
    }, 300);

    return () => {
      window.clearTimeout(failsafe);
      window.clearTimeout(raf);
      io.disconnect();
    };
  }, [delay, pathname]);

  return (
    <div ref={ref} className={`${hidden ? "reveal" : ""} ${className}`}>
      {children}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

// Scroll reveal via IntersectionObserver (sekali tampil, lalu lepas).
// Aman saat JS lambat: konten mulai VISIBLE, lalu disembunyikan HANYA bila
// observer aktif (no-JS = selalu terbaca; tak ada konten pudar).
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

  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) return;
    setHidden(true);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            (e.target as HTMLElement).style.transitionDelay = `${delay}ms`;
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.08 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);

  return (
    <div ref={ref} className={`${hidden ? "reveal" : ""} ${className}`}>
      {children}
    </div>
  );
}

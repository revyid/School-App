"use client";

// F5: RichText — SATU komponen markdown untuk seluruh aplikasi (D8).
// react-markdown + remark-gfm + rehype-sanitize. Tanpa dangerouslySetInnerHTML.
// Dipakai: chat RAI (mode streaming), soal asesmen, instruksi tugas, pengumuman.
import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import Link from "next/link";
import { CheckIcon, CopyIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  closeUnbalancedMarkdown,
  isSafeExternalUrl,
  isSafeInternalPath,
  isSafeMediaSrc,
} from "@/lib/markdown-utils";
import "./rich-text.css";

const VIDEO_EXT = /\.(mp4|webm)(\?|$)/i;

function CodeBlock(props: React.ComponentPropsWithoutRef<"pre">) {
  const [copied, setCopied] = React.useState(false);
  const ref = React.useRef<HTMLPreElement>(null);
  const onCopy = async () => {
    const text = ref.current?.textContent ?? "";
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard tidak tersedia */ }
  };
  return (
    <div className="rt-codeblock relative">
      <button
        type="button"
        onClick={onCopy}
        className="rt-copy absolute right-2 top-2 z-10 inline-flex cursor-pointer items-center gap-1 rounded-lg border border-line bg-cream px-2 py-1 text-[10px] font-bold text-muted-strong shadow-sm hover:bg-paper"
        aria-label="Salin kode"
      >
        {copied ? <CheckIcon className="size-3" /> : <CopyIcon className="size-3" />}
        {copied ? "Tersalin" : "Salin"}
      </button>
      <pre ref={ref} {...props} />
    </div>
  );
}

export default function RichText({
  text,
  streaming = false,
  compact = false,
  className,
}: {
  text: string;
  /** Mode streaming: token belum lengkap ditutup otomatis, render di-throttle rAF. */
  streaming?: boolean;
  /** compact: heading mengecil (konteks chat/soal). */
  compact?: boolean;
  className?: string;
}) {
  // Streaming: tutup token pada SALINAN teks + throttle per rAF agar re-render hemat.
  const [rendered, setRendered] = React.useState(() => (streaming ? closeUnbalancedMarkdown(text) : text));
  const pendingRef = React.useRef(text);
  const rafRef = React.useRef<number | null>(null);

  pendingRef.current = text;
  React.useEffect(() => {
    if (!streaming) {
      setRendered(text);
      return;
    }
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      setRendered(closeUnbalancedMarkdown(pendingRef.current));
    });
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [text, streaming]);

  return (
    <div className={cn("rt", compact && "rt-compact", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          a({ href, children }) {
            const to = href ?? "";
            if (isSafeInternalPath(to)) {
              return (
                <Link href={to} className="rt-link">
                  {children}
                </Link>
              );
            }
            if (isSafeExternalUrl(to)) {
              return (
                <a href={to} target="_blank" rel="noopener noreferrer" className="rt-link">
                  {children}
                </a>
              );
            }
            return <span>{children}</span>; // javascript: dst → ditolak
          },
          img({ src, alt }) {
            const s = typeof src === "string" ? src : "";
            if (!isSafeMediaSrc(s)) return <span className="rt-media-rejected">{alt || ""}</span>;
            // eslint-disable-next-line @next/next/no-img-element
            return <img src={s} alt={alt ?? ""} className="rt-img" loading="lazy" />;
          },
          // Video: sintaks ![alt](/api/…video.mp4) → elemen <video> (same-origin saja).
          p({ children, ...rest }) {
            const kids = React.Children.toArray(children);
            if (kids.length === 1 && React.isValidElement(kids[0]) && kids[0].type === "img") {
              const imgEl = kids[0] as React.ReactElement<{ src?: string; alt?: string }>;
              const src = typeof imgEl.props.src === "string" ? imgEl.props.src : "";
              if (VIDEO_EXT.test(src) && isSafeMediaSrc(src)) {
                return (
                  <video controls preload="metadata" playsInline className="rt-video">
                    <source src={src} />
                  </video>
                );
              }
            }
            return <p {...rest}>{children}</p>;
          },
          pre: CodeBlock,
        }}
      >
        {rendered}
      </ReactMarkdown>
    </div>
  );
}

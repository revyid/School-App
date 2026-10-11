"use client";

// Renderer markdown minimal untuk chat RAI: head, list, quote, code, bold/italic/link.
// Tanpa dependensi. HTML user di-escape dulu — tidak ada dangerouslySetInnerHTML mentah.
import { Fragment, type ReactNode } from "react";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderInline(src: string, keyPrefix: string): ReactNode[] {
  // Token: `code`, **bold**, *italic*, [teks](url)
  const parts: ReactNode[] = [];
  const rx = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)|(\[[^\]]+\]\((?:https?:\/\/[^)\s]+|\/[^)\s]*)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = rx.exec(src)) !== null) {
    if (m.index > last) parts.push(<Fragment key={`${keyPrefix}-t${k++}`}>{src.slice(last, m.index)}</Fragment>);
    const tok = m[0];
    if (tok.startsWith("`")) {
      parts.push(
        <code key={`${keyPrefix}-c${k++}`} style={{ background: "rgba(23,23,22,.07)", borderRadius: 6, padding: "1px 6px", fontSize: "0.92em" }}>
          {tok.slice(1, -1)}
        </code>
      );
    } else if (tok.startsWith("**")) {
      parts.push(<strong key={`${keyPrefix}-b${k++}`}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("*")) {
      parts.push(<em key={`${keyPrefix}-i${k++}`}>{tok.slice(1, -1)}</em>);
    } else {
      const mm = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(tok);
      if (mm) {
        parts.push(
          <a key={`${keyPrefix}-a${k++}`} href={mm[2]} target={mm[2].startsWith("http") ? "_blank" : undefined} rel="noreferrer" style={{ color: "#50643e", fontWeight: 700 }}>
            {mm[1]}
          </a>
        );
      } else {
        parts.push(<Fragment key={`${keyPrefix}-x${k++}`}>{tok}</Fragment>);
      }
    }
    last = m.index + tok.length;
  }
  if (last < src.length) parts.push(<Fragment key={`${keyPrefix}-t${k++}`}>{src.slice(last)}</Fragment>);
  return parts;
}

export default function RaiMarkdown({ text }: { text: string }) {
  // Escape HTML dulu, lalu parse blok per baris.
  const safe = escapeHtml(text);
  const lines = safe.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let b = 0;
  while (i < lines.length) {
    const line = lines[i];
    // Code fence
    if (line.trim().startsWith("```")) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) { buf.push(lines[i]); i++; }
      i++;
      blocks.push(
        <pre key={`b${b++}`} style={{ background: "#171716", color: "#f4f3ec", borderRadius: 10, padding: "10px 12px", fontSize: 12, overflowX: "auto", margin: "6px 0" }}>
          <code>{buf.join("\n")}</code>
        </pre>
      );
      continue;
    }
    // Heading
    const h = /^(#{1,3})\s+(.+)$/.exec(line);
    if (h) {
      const lvl = h[1].length;
      blocks.push(
        <div key={`b${b++}`} style={{ fontWeight: 800, fontSize: lvl === 1 ? 15 : 14, margin: "8px 0 4px" }}>
          {renderInline(h[2], `h${b}`)}
        </div>
      );
      i++;
      continue;
    }
    // Quote
    if (/^&gt;\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^&gt;\s?/.test(lines[i])) { buf.push(lines[i].replace(/^&gt;\s?/, "")); i++; }
      blocks.push(
        <div key={`b${b++}`} style={{ borderLeft: "3px solid #50643e", paddingLeft: 10, color: "#575752", margin: "6px 0" }}>
          {buf.map((l, j) => (
            <div key={j}>{renderInline(l, `q${b}-${j}`)}</div>
          ))}
        </div>
      );
      continue;
    }
    // List
    if (/^(\s*[-*]|\s*\d+[.)])\s+/.test(line)) {
      const items: string[] = [];
      let ordered = false;
      while (i < lines.length && /^(\s*[-*]|\s*\d+[.)])\s+/.test(lines[i])) {
        const lm = /^(\s*(?:[-*]|\d+[.)]))\s+(.*)$/.exec(lines[i]);
        if (lm && /^\s*\d/.test(lm[1])) ordered = true;
        items.push(lm ? lm[2] : lines[i]);
        i++;
      }
      const List = ordered ? "ol" : "ul";
      blocks.push(
        <List key={`b${b++}`} style={{ margin: "6px 0", paddingLeft: 20, display: "grid", gap: 3 }}>
          {items.map((it, j) => (
            <li key={j}>{renderInline(it, `l${b}-${j}`)}</li>
          ))}
        </List>
      );
      continue;
    }
    // Kosong
    if (line.trim() === "") { i++; continue; }
    // Paragraf (gabung baris berurutan)
    const buf: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim() !== "" && !/^(#{1,3}\s|```|&gt;\s?|(\s*[-*]|\s*\d+[.)])\s+)/.test(lines[i])) {
      buf.push(lines[i]);
      i++;
    }
    blocks.push(<p key={`b${b++}`} style={{ margin: "4px 0" }}>{renderInline(buf.join("\n"), `p${b}`)}</p>);
  }
  return <>{blocks}</>;
}

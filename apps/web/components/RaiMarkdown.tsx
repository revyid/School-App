"use client";

// Renderer markdown minimal untuk chat RAI: head, list, quote, kode, bold/italic/link.
// HTML di-escape dulu lalu di-unescape hanya saat ditampilkan sebagai teks (kode/link);
// tidak ada dangerouslySetInnerHTML. Blok kode memakai CodeBlock registry + shiki.
import { Fragment, type ReactNode } from "react";
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockLine,
  CodeBlockTitle,
} from "@/components/ui/code-block";
import { useHighlightedCode } from "@/hooks/use-highlighted-code";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function unescapeHtml(s: string): string {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

function MdCode({ code, lang }: { code: string; lang: string }) {
  const lines = useHighlightedCode(code, lang);
  return (
    <CodeBlock className="my-2 bg-white!" size="sm">
      <CodeBlockHeader>
        <CodeBlockTitle>{lang || "kode"}</CodeBlockTitle>
        <CodeBlockActions>
          <CodeBlockCopyButton value={code} />
        </CodeBlockActions>
      </CodeBlockHeader>
      <CodeBlockContent>
        {lines.map((line, index) => (
          <CodeBlockLine key={index}>{line}</CodeBlockLine>
        ))}
      </CodeBlockContent>
    </CodeBlock>
  );
}

function renderInline(src: string, keyPrefix: string): ReactNode[] {
  // Token: `code`, **bold**, *italic*, [teks](url)
  const parts: ReactNode[] = [];
  const rx = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)|(\[[^\]]+\]\((?:https?:\/\/[^)\s]+|\/[^)\s]*)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = rx.exec(src)) !== null) {
    if (m.index > last) parts.push(<Fragment key={`${keyPrefix}-t${k++}`}>{unescapeHtml(src.slice(last, m.index))}</Fragment>);
    const tok = m[0];
    if (tok.startsWith("`")) {
      parts.push(
        <code key={`${keyPrefix}-c${k++}`} className="rounded-md bg-ink/8 px-1.5 py-px font-mono text-[0.92em]">
          {unescapeHtml(tok.slice(1, -1))}
        </code>
      );
    } else if (tok.startsWith("**")) {
      parts.push(<strong key={`${keyPrefix}-b${k++}`} className="font-bold">{unescapeHtml(tok.slice(2, -2))}</strong>);
    } else if (tok.startsWith("*")) {
      parts.push(<em key={`${keyPrefix}-i${k++}`} className="italic">{unescapeHtml(tok.slice(1, -1))}</em>);
    } else {
      const mm = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(tok);
      if (mm) {
        const href = unescapeHtml(mm[2]);
        const external = href.startsWith("http");
        parts.push(
          <a
            key={`${keyPrefix}-a${k++}`}
            href={href}
            target={external ? "_blank" : undefined}
            rel="noreferrer"
            className="font-bold text-olive-deep underline decoration-olive-deep/40 underline-offset-2"
          >
            {unescapeHtml(mm[1])}
          </a>
        );
      } else {
        parts.push(<Fragment key={`${keyPrefix}-x${k++}`}>{unescapeHtml(tok)}</Fragment>);
      }
    }
    last = m.index + tok.length;
  }
  if (last < src.length) parts.push(<Fragment key={`${keyPrefix}-t${k++}`}>{unescapeHtml(src.slice(last))}</Fragment>);
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
      const lang = line.trim().slice(3).trim().toLowerCase();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) { buf.push(lines[i]); i++; }
      i++;
      blocks.push(<MdCode key={`b${b++}`} code={unescapeHtml(buf.join("\n"))} lang={lang} />);
      continue;
    }
    // Heading
    const h = /^(#{1,3})\s+(.+)$/.exec(line);
    if (h) {
      const lvl = h[1].length;
      blocks.push(
        <p key={`b${b++}`} className={`mb-1 mt-2 font-extrabold text-ink ${lvl === 1 ? "text-[15px]" : "text-[14px]"}`}>
          {renderInline(h[2], `h${b}`)}
        </p>
      );
      i++;
      continue;
    }
    // Quote
    if (/^&gt;\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^&gt;\s?/.test(lines[i])) { buf.push(lines[i].replace(/^&gt;\s?/, "")); i++; }
      blocks.push(
        <blockquote key={`b${b++}`} className="my-1.5 border-s-[3px] border-olive-deep ps-2.5 text-muted-strong">
          {buf.map((l, j) => (
            <div key={j}>{renderInline(l, `q${b}-${j}`)}</div>
          ))}
        </blockquote>
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
        <List key={`b${b++}`} className={`my-1.5 grid gap-[3px] ps-5 ${ordered ? "list-decimal" : "list-disc"}`}>
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
    blocks.push(<p key={`b${b++}`} className="my-1">{renderInline(buf.join("\n"), `p${b}`)}</p>);
  }
  return <>{blocks}</>;
}

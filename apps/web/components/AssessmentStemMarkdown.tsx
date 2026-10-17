// Render batang soal: saat mengetik tampilkan chip (IMG) / (VID),
// di preview + halaman siswa tampilkan gambar / video beneran.
// Tanpa dependensi baru: parse token manual, escape HTML, tanpa tombol.
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

type Props = {
  content: string;
  /** true = mode mengetik (chip saja). false = render media beneran. */
  imageAsButton?: boolean;
};

const TOKEN_RE = /!\[([^\]\r\n]*)\]\(([^)\s]+)\)|\(IMG\)|\(VID\)/g;

/** Teks polos untuk preview chip: token diganti label. */
export function stemPreviewText(content: string): string {
  return content
    .replace(/!\[([^\]\r\n]*)\]\(([^)\s]+)\)/g, (_, alt: string) => `[gambar${alt ? `: ${alt}` : ""}]`)
    .replace(/\(IMG\)/g, "[gambar]")
    .replace(/\(VID\)/g, "[video]");
}

export default function AssessmentStemMarkdown({ content, imageAsButton = false }: Props) {
  if (imageAsButton) {
    // Mode mengetik: satu baris chip statis, bukan button.
    const parts: React.ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    TOKEN_RE.lastIndex = 0;
    let k = 0;
    while ((m = TOKEN_RE.exec(content)) !== null) {
      if (m.index > last) parts.push(<span key={k++}>{content.slice(last, m.index)}</span>);
      const isVid = m[0] === "(VID)" || /\.(mp4|webm)/i.test(m[2] ?? "");
      const alt = m[1] || (isVid ? "video" : "gambar");
      parts.push(
        <span className="inline-flex items-center gap-[6px] border border-solid border-line-strong rounded-full pt-[5px] pr-[11px] pb-[5px] pl-[11px] bg-sage text-sage-deep text-xs font-bold align-middle"
          key={k++}
          
        >
          <span aria-hidden="true">{isVid ? "▶" : "▧"}</span>{alt}
        </span>,
      );
      last = m.index + m[0].length;
    }
    if (last < content.length) parts.push(<span key={k++}>{content.slice(last)}</span>);
    return <span className="whitespace-pre-wrap">{parts}</span>;
  }
  // Mode tampil: paragraf + gambar + video beneran.
  const blocks = content.split(/\n{2,}/);
  return (
    <span className="grid gap-2">
      {blocks.map((b, i) => {
        const nodes: React.ReactNode[] = [];
        let last = 0;
        let m: RegExpExecArray | null;
        TOKEN_RE.lastIndex = 0;
        let k = 0;
        let hasMedia = false;
        while ((m = TOKEN_RE.exec(b)) !== null) {
          if (m.index > last) nodes.push(<span key={k++}>{b.slice(last, m.index)}</span>);
          hasMedia = true;
          if (m[2] && /\.(mp4|webm)(\?|$)/i.test(m[2])) {
            nodes.push(
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video className="block max-w-full rounded-xl mt-2 mr-0 mb-2 ml-0" key={k++} src={m[2]} controls preload="metadata" />,
            );
          } else if (m[2]) {
            nodes.push(
              // eslint-disable-next-line @next/next/no-img-element
              <img className="block max-w-full max-h-[480px] object-contain rounded-xl mt-2 mr-0 mb-2 ml-0" key={k++} src={m[2]} alt={esc(m[1] || "Gambar soal")} loading="lazy" />,
            );
          } else if (m[0] === "(VID)") {
            nodes.push(<span className="text-xs text-muted" key={k++}>[video belum diunggah]</span>);
          } else {
            nodes.push(<span className="text-xs text-muted" key={k++}>[gambar belum diunggah]</span>);
          }
          last = m.index + m[0].length;
        }
        if (last < b.length) nodes.push(<span key={k++}>{b.slice(last)}</span>);
        if (!hasMedia) return <span className="whitespace-pre-wrap" key={i}>{b}</span>;
        return <span className="whitespace-pre-wrap" key={i}>{nodes}</span>;
      })}
    </span>
  );
}

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
        <span
          key={k++}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            border: "1px solid #c9cabb", borderRadius: 999, padding: "5px 11px",
            background: "#eef0e6", color: "#3d4935", fontSize: 12, fontWeight: 700,
            verticalAlign: "middle",
          }}
        >
          <span aria-hidden="true">{isVid ? "▶" : "▧"}</span>{alt}
        </span>,
      );
      last = m.index + m[0].length;
    }
    if (last < content.length) parts.push(<span key={k++}>{content.slice(last)}</span>);
    return <span style={{ whiteSpace: "pre-wrap" }}>{parts}</span>;
  }
  // Mode tampil: paragraf + gambar + video beneran.
  const blocks = content.split(/\n{2,}/);
  return (
    <span style={{ display: "grid", gap: 8 }}>
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
              <video key={k++} src={m[2]} controls preload="metadata" style={{ display: "block", maxWidth: "100%", borderRadius: 12, margin: "8px 0" }} />,
            );
          } else if (m[2]) {
            nodes.push(
              // eslint-disable-next-line @next/next/no-img-element
              <img key={k++} src={m[2]} alt={esc(m[1] || "Gambar soal")} loading="lazy" style={{ display: "block", maxWidth: "100%", maxHeight: 480, objectFit: "contain", borderRadius: 12, margin: "8px 0" }} />,
            );
          } else if (m[0] === "(VID)") {
            nodes.push(<span key={k++} style={{ fontSize: 12, color: "#8a8a82" }}>[video belum diunggah]</span>);
          } else {
            nodes.push(<span key={k++} style={{ fontSize: 12, color: "#8a8a82" }}>[gambar belum diunggah]</span>);
          }
          last = m.index + m[0].length;
        }
        if (last < b.length) nodes.push(<span key={k++}>{b.slice(last)}</span>);
        if (!hasMedia) return <span key={i} style={{ whiteSpace: "pre-wrap" }}>{b}</span>;
        return <span key={i} style={{ whiteSpace: "pre-wrap" }}>{nodes}</span>;
      })}
    </span>
  );
}

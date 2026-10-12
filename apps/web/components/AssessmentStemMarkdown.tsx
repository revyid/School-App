import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = {
  content: string;
  imageAsButton?: boolean;
};

export default function AssessmentStemMarkdown({ content, imageAsButton = false }: Props) {
  const components: Components = {
    img: ({ src, alt }) => {
      if (imageAsButton) {
        return (
          <button
            type="button"
            aria-label={`Gambar soal${alt ? `: ${alt}` : ""}`}
            title="Gambar tersimpan sebagai Markdown"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              border: "1px solid #c9cabb", borderRadius: 999, padding: "5px 11px",
              background: "#eef0e6", color: "#3d4935", font: "inherit", fontSize: 12,
              fontWeight: 700, verticalAlign: "middle", cursor: "default",
            }}
          >
            <span aria-hidden="true">▧</span>{alt || "IMG · gambar"}
          </button>
        );
      }
      if (!src) return null;
      // ReactMarkdown tidak memproses HTML mentah; src tetap dirender sebagai elemen gambar biasa.
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={src} alt={alt || "Gambar soal"} loading="lazy" style={{ display: "block", maxWidth: "100%", maxHeight: 480, objectFit: "contain", borderRadius: 12, margin: "8px 0" }} />;
    },
  };

  return <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{content}</ReactMarkdown>;
}

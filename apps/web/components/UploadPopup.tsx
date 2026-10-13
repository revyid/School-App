"use client";

// UploadPopup — drag-drop atau klik, progress bar, preview nama file.
// Usage:
//   <UploadPopup
//     accept="image/jpeg,image/png,application/pdf"
//     maxMb={10}
//     onFile={(f) => setFile(f)}         // file dipilih
//     onUpload={async (f, onProgress) => { /* kirim, panggil onProgress(0..100) */ }}
//   />
import { useCallback, useRef, useState } from "react";
import { UploadCloudIcon, FileIcon, XIcon, CheckIcon } from "lucide-react";

export type UploadProgressFn = (pct: number) => void;

interface Props {
  accept?: string;
  maxMb?: number;
  label?: string;
  hint?: string;
  disabled?: boolean;
  /** Dipanggil saat file dipilih (sebelum upload). */
  onFile?: (f: File | null) => void;
  /** Jika disediakan, UploadPopup langsung mengupload dan menampilkan progress. */
  onUpload?: (f: File, onProgress: UploadProgressFn) => Promise<void>;
  /** Tampil sebagai inline card, bukan dialog modal. Default: true */
  inline?: boolean;
}

function fmtSize(n: number) {
  if (n > 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

export default function UploadPopup({
  accept,
  maxMb = 50,
  label = "Unggah file",
  hint,
  disabled = false,
  onFile,
  onUpload,
  inline = true,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null); // 0-100 saat upload, null = idle
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = useCallback(
    async (f: File) => {
      setError(null);
      setDone(false);
      if (maxMb && f.size > maxMb * 1024 * 1024) {
        setError(`Ukuran maks ${maxMb} MB. File ini ${fmtSize(f.size)}.`);
        return;
      }
      setFile(f);
      onFile?.(f);
      if (onUpload) {
        setProgress(0);
        try {
          await onUpload(f, (pct) => setProgress(pct));
          setDone(true);
          setProgress(null);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Upload gagal");
          setProgress(null);
        }
      }
    },
    [maxMb, onFile, onUpload],
  );

  const clear = useCallback(() => {
    setFile(null);
    setProgress(null);
    setDone(false);
    setError(null);
    onFile?.(null);
    if (inputRef.current) inputRef.current.value = "";
  }, [onFile]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (disabled) return;
      const f = e.dataTransfer.files[0];
      if (f) void pick(f);
    },
    [disabled, pick],
  );

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); if (!disabled) setDragging(true); };
  const onDragLeave = () => setDragging(false);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void pick(f);
  };

  const Container = inline ? "div" : "div"; // bisa diperluas ke Dialog nanti

  return (
    <Container>
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDragEnd={onDragLeave}
        onClick={() => !disabled && !file && inputRef.current?.click()}
        onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !disabled && !file) inputRef.current?.click(); }}
        className="relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-6 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        style={{
          borderColor: dragging ? "var(--color-ink)" : error ? "#c94b35" : "rgba(23,23,22,.22)",
          background: dragging ? "rgba(23,23,22,.04)" : "#fffdf8",
          cursor: disabled ? "not-allowed" : file ? "default" : "pointer",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {/* Idle state */}
        {!file && !error && (
          <>
            <UploadCloudIcon size={32} strokeWidth={1.5} className="text-muted-strong" />
            <div>
              <p className="text-[13px] font-bold text-ink">{label}</p>
              <p className="mt-0.5 text-[11px] text-muted-strong">
                {hint ?? `Klik atau drag-drop di sini`}
                {maxMb ? ` · maks ${maxMb} MB` : ""}
              </p>
            </div>
          </>
        )}

        {/* File dipilih + progress/done */}
        {file && (
          <div className="flex w-full min-w-0 flex-col gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              {done
                ? <CheckIcon size={20} className="shrink-0 text-olive" />
                : <FileIcon size={20} className="shrink-0 text-muted-strong" />
              }
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-[13px] font-bold text-ink">{file.name}</p>
                <p className="text-[11px] text-muted-strong">{fmtSize(file.size)}{done ? " · Selesai" : ""}</p>
              </div>
              {/* Hapus — hanya saat idle atau selesai */}
              {progress === null && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); clear(); }}
                  className="shrink-0 rounded-full p-1 text-muted-strong hover:bg-paper-deep hover:text-ink"
                  aria-label="Hapus file"
                >
                  <XIcon size={14} />
                </button>
              )}
            </div>

            {/* Progress bar */}
            {progress !== null && (
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-paper-deep">
                <div
                  className="h-full rounded-full bg-ink transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
            {progress !== null && (
              <p className="text-[11px] text-muted-strong text-left">{progress < 100 ? `Mengunggah… ${progress}%` : "Memproses…"}</p>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex w-full flex-col gap-1">
            <p className="text-[13px] font-bold text-terracotta">{error}</p>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); clear(); }}
              className="text-[11px] font-bold text-muted-strong underline"
            >
              Pilih file lain
            </button>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={onInputChange}
          disabled={disabled}
          tabIndex={-1}
        />
      </div>
    </Container>
  );
}

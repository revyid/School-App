"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/app/lib/api";

const IMAGE_TOKEN = /!\[([^\]\r\n]*)\]\(([^)\s]+)\)|\(IMG\)/g;

type Props = {
  value: string;
  onChange: (value: string) => void;
  classId: string;
};

function makeImageButton(doc: Document, nextId: () => string, url = "", alt = "gambar") {
  const button = doc.createElement("button");
  button.type = "button";
  button.contentEditable = "false";
  button.dataset.assessmentImage = "true";
  button.dataset.tokenId = nextId();
  button.dataset.url = url;
  button.dataset.alt = alt || "gambar";
  button.setAttribute("aria-label", url ? `Gambar terunggah: ${alt || "gambar"}. Backspace untuk menghapus` : "IMG belum diunggah. Klik untuk mengunggah gambar");
  button.title = url ? "Klik untuk mengganti gambar · Backspace untuk menghapus" : "Klik untuk mengunggah gambar";
  button.textContent = url ? `▧  ${alt || "Gambar terunggah"}` : "+  IMG · Unggah gambar";
  button.style.cssText = "display:inline-flex;align-items:center;gap:6px;margin:2px 3px;padding:5px 11px;border:1px solid #c9cabb;border-radius:999px;background:#eef0e6;color:#3d4935;font:inherit;font-size:12px;font-weight:700;line-height:1.4;vertical-align:middle;cursor:pointer;";
  return button;
}

function appendSource(root: HTMLElement, source: string, nextId: () => string) {
  const doc = root.ownerDocument;
  const regex = new RegExp(IMAGE_TOKEN.source, "g");
  let cursor = 0;
  for (const match of source.matchAll(regex)) {
    const index = match.index ?? 0;
    if (index > cursor) root.appendChild(doc.createTextNode(source.slice(cursor, index)));
    const isMarkdown = match[1] !== undefined;
    root.appendChild(makeImageButton(doc, nextId, isMarkdown ? match[2] : "", isMarkdown ? match[1] : "gambar"));
    cursor = index + match[0].length;
  }
  if (cursor < source.length) root.appendChild(doc.createTextNode(source.slice(cursor)));
}

function serializeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue ?? "";
  if (!(node instanceof HTMLElement)) return "";
  if (node.dataset.assessmentImage === "true") {
    const url = node.dataset.url ?? "";
    const alt = (node.dataset.alt || "gambar").replace(/[\]\r\n]/g, "");
    return url ? `![${alt}](${url})` : "(IMG)";
  }
  if (node.tagName === "BR") return "\n";
  const body = Array.from(node.childNodes, serializeNode).join("");
  if (node.tagName === "DIV" || node.tagName === "P") return `${body}\n`;
  return body;
}

function serializeEditor(root: HTMLElement): string {
  return Array.from(root.childNodes, serializeNode).join("").replace(/\n$/, "");
}

function tokenizeTextImages(root: HTMLElement, nextId: () => string): HTMLElement | null {
  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let current: Node | null;
  while ((current = walker.nextNode())) {
    if (!(current.parentElement?.closest("[data-assessment-image='true']"))) textNodes.push(current as Text);
  }

  let lastButton: HTMLElement | null = null;
  for (const textNode of textNodes) {
    const text = textNode.nodeValue ?? "";
    const regex = new RegExp(IMAGE_TOKEN.source, "g");
    const matches = [...text.matchAll(regex)];
    if (!matches.length || !textNode.parentNode) continue;
    const fragment = doc.createDocumentFragment();
    let cursor = 0;
    for (const match of matches) {
      const index = match.index ?? 0;
      if (index > cursor) fragment.appendChild(doc.createTextNode(text.slice(cursor, index)));
      const isMarkdown = match[1] !== undefined;
      const button = makeImageButton(doc, nextId, isMarkdown ? match[2] : "", isMarkdown ? match[1] : "gambar");
      fragment.appendChild(button);
      lastButton = button;
      cursor = index + match[0].length;
    }
    if (cursor < text.length) fragment.appendChild(doc.createTextNode(text.slice(cursor)));
    textNode.parentNode.replaceChild(fragment, textNode);
  }

  return lastButton;
}

export default function AssessmentQuestionEditor({ value, onChange, classId }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastValueRef = useRef<string | null>(null);
  const tokenCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [targetTokenId, setTargetTokenId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextId = () => `assessment-image-${++tokenCounter.current}`;

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || lastValueRef.current === value) return;
    editor.replaceChildren();
    appendSource(editor, value, nextId);
    lastValueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (!targetTokenId) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !uploading) setTargetTokenId(null);
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [targetTokenId, uploading]);

  function publishEditorValue() {
    const editor = editorRef.current;
    if (!editor) return;
    const next = serializeEditor(editor);
    lastValueRef.current = next;
    onChange(next);
  }

  function onInput() {
    const editor = editorRef.current;
    if (!editor) return;
    const insertedButton = tokenizeTextImages(editor, nextId);
    publishEditorValue();
    if (insertedButton) {
      const selection = window.getSelection();
      const range = document.createRange();
      range.setStartAfter(insertedButton);
      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  }

  function removeChip(button: HTMLElement) {
    const parent = button.parentNode;
    if (!parent) return;
    const index = Array.prototype.indexOf.call(parent.childNodes, button) as number;
    const range = document.createRange();
    range.setStart(parent, Math.max(0, index));
    range.collapse(true);
    button.remove();
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    editorRef.current?.focus();
    publishEditorValue();
  }

  function adjacentChipAtCaret(key: string): HTMLElement | null {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !selection.isCollapsed) return null;
    const range = selection.getRangeAt(0);
    const container = range.startContainer;
    let candidate: Node | null = null;
    if (container.nodeType === Node.TEXT_NODE) {
      const text = container as Text;
      if (key === "Backspace" && range.startOffset === 0) candidate = text.previousSibling;
      if (key === "Delete" && range.startOffset === (text.nodeValue ?? "").length) candidate = text.nextSibling;
    } else if (container instanceof HTMLElement) {
      candidate = key === "Backspace"
        ? container.childNodes[range.startOffset - 1] ?? null
        : container.childNodes[range.startOffset] ?? null;
    }
    return candidate instanceof HTMLElement && candidate.dataset.assessmentImage === "true" ? candidate : null;
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const target = event.target instanceof HTMLElement
      ? event.target.closest<HTMLElement>("[data-assessment-image='true']")
      : null;
    const adjacent = event.key === "Backspace" || event.key === "Delete"
      ? adjacentChipAtCaret(event.key)
      : null;
    if ((event.key === "Backspace" || event.key === "Delete") && (target || adjacent)) {
      event.preventDefault();
      removeChip(target ?? adjacent!);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const selection = window.getSelection();
      if (!selection?.rangeCount) return;
      const range = selection.getRangeAt(0);
      if (!editorRef.current?.contains(range.startContainer)) return;
      range.deleteContents();
      const br = document.createElement("br");
      range.insertNode(br);
      range.setStartAfter(br);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      onInput();
    }
  }

  function onChipClick(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target instanceof HTMLElement
      ? event.target.closest<HTMLButtonElement>("[data-assessment-image='true']")
      : null;
    if (!target) return;
    event.preventDefault();
    setError(null);
    setTargetTokenId(target.dataset.tokenId ?? null);
  }

  function findTargetChip() {
    return Array.from(editorRef.current?.querySelectorAll<HTMLElement>("[data-assessment-image='true']") ?? [])
      .find((chip) => chip.dataset.tokenId === targetTokenId) ?? null;
  }

  function closePopup() {
    if (uploading) return;
    setTargetTokenId(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function upload(file?: File) {
    if (!file || uploading) return;
    setError(null);
    if (!classId) {
      setError("Pilih kelas terlebih dahulu sebelum mengunggah gambar.");
      return;
    }
    if (!/^image\/(jpeg|png)$/.test(file.type)) {
      setError("Format yang didukung hanya JPG/JPEG dan PNG.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Ukuran gambar maksimal 5 MB.");
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.set("classId", classId);
      form.set("file", file);
      const response = await api("/api/assessment-images", { method: "POST", body: form });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || typeof result.url !== "string") {
        throw new Error(result.error || `Gagal mengunggah (${response.status})`);
      }
      const chip = findTargetChip();
      if (!chip) throw new Error("Tombol gambar tidak ditemukan. Coba masukkan (IMG) lagi.");
      chip.dataset.url = result.url;
      chip.dataset.alt = chip.dataset.alt || "gambar";
      chip.textContent = `▧  ${chip.dataset.alt || "Gambar terunggah"}`;
      chip.setAttribute("aria-label", `Gambar terunggah: ${chip.dataset.alt || "gambar"}. Backspace untuk menghapus`);
      chip.title = "Klik untuk mengganti gambar · Backspace untuk menghapus";
      publishEditorValue();
      setTargetTokenId(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal mengunggah gambar.");
    } finally {
      setUploading(false);
    }
  }

  function removeTarget() {
    const chip = findTargetChip();
    if (chip) removeChip(chip);
    setTargetTokenId(null);
    setError(null);
  }

  const targetChip = findTargetChip();

  return (
    <>
      <div
        ref={editorRef}
        role="textbox"
        aria-label="Format soal asesmen. Ketik (IMG) untuk menambahkan gambar."
        aria-multiline="true"
        contentEditable="plaintext-only"
        suppressContentEditableWarning
        onInput={onInput}
        onKeyDown={onKeyDown}
        onClick={onChipClick}
        spellCheck
        style={{
          minHeight: 220, maxHeight: 520, overflowY: "auto", whiteSpace: "pre-wrap",
          overflowWrap: "anywhere", borderRadius: 14, border: "1px solid rgba(23,23,22,.25)",
          background: "#fffdf8", padding: "12px 14px", fontSize: 13,
          fontFamily: "var(--font-mono, monospace)", lineHeight: 1.75, outlineColor: "#78875f",
        }}
      />
      <p style={{ margin: "6px 0 0", fontSize: 11, color: "#8a8a82" }}>
        Ketik <code>(IMG)</code> untuk membuat tombol gambar. Klik tombolnya untuk memilih file atau drag-and-drop; gambar tersimpan sebagai URL Markdown. Fokuskan tombol lalu tekan Backspace untuk menghapusnya.
      </p>

      {targetTokenId && (
        <div
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) closePopup(); }}
          style={{ position: "fixed", inset: 0, zIndex: 10000, display: "grid", placeItems: "center", padding: 18, background: "rgba(16,18,15,.5)" }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="assessment-image-title"
            onMouseDown={(event) => event.stopPropagation()}
            style={{ width: "min(100%, 480px)", borderRadius: 20, padding: 22, background: "#fffdf8", boxShadow: "0 24px 80px rgba(0,0,0,.28)" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
              <div>
                <h3 id="assessment-image-title" style={{ margin: 0, fontSize: 18 }}>Unggah gambar soal</h3>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "#6f7067" }}>Pilih gambar atau lepaskan file ke area di bawah.</p>
              </div>
              <button type="button" onClick={closePopup} disabled={uploading} aria-label="Tutup popup" style={{ border: 0, background: "transparent", fontSize: 20, cursor: "pointer", color: "#68685e" }}>×</button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,.jpg,.jpeg,.png"
              hidden
              onChange={(event) => upload(event.target.files?.[0])}
            />
            <div
              onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
              onDragLeave={(event) => { event.preventDefault(); setDragging(false); }}
              onDrop={(event) => { event.preventDefault(); setDragging(false); upload(event.dataTransfer.files?.[0]); }}
              style={{ marginTop: 18, padding: "28px 18px", border: `1.5px dashed ${dragging ? "#557443" : "#b7b9a7"}`, borderRadius: 16, background: dragging ? "#f0f5e9" : "#f7f6ef", textAlign: "center", transition: "background .15s, border-color .15s" }}
            >
              <div aria-hidden="true" style={{ fontSize: 30, color: "#64764f" }}>▧</div>
              <strong style={{ display: "block", marginTop: 8, fontSize: 14 }}>Jatuhkan gambar di sini</strong>
              <span style={{ display: "block", margin: "5px 0 14px", fontSize: 12, color: "#76776d" }}>JPG atau PNG · maksimal 5 MB</span>
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{ border: 0, borderRadius: 999, padding: "9px 16px", background: "#22251f", color: "#fffdf8", fontWeight: 700, cursor: uploading ? "wait" : "pointer" }}>
                {uploading ? "Mengunggah…" : "Pilih file"}
              </button>
            </div>

            {error && <p role="alert" style={{ margin: "12px 0 0", color: "#b8332b", fontSize: 13 }}>{error}</p>}
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 16 }}>
              {targetChip?.dataset.url ? <button type="button" onClick={removeTarget} disabled={uploading} style={{ padding: "8px 12px", border: "1px solid #e1bbb5", borderRadius: 10, color: "#a13a32", background: "#fff8f6", cursor: "pointer" }}>Hapus gambar</button> : <span />}
              <button type="button" onClick={closePopup} disabled={uploading} style={{ padding: "8px 12px", border: "1px solid #d7d6cc", borderRadius: 10, color: "#42433d", background: "#fff", cursor: "pointer" }}>Tutup</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

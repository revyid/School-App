// F5-T: tes unit utilitas RichText (fungsi murni, tanpa DOM).
import { describe, expect, it } from "vitest";
import {
  closeUnbalancedMarkdown,
  isSafeExternalUrl,
  isSafeInternalPath,
  isSafeMediaSrc,
  tidyTruncated,
} from "@/lib/markdown-utils";

describe("isSafeInternalPath", () => {
  it("menerima path internal absolut", () => {
    expect(isSafeInternalPath("/siswa/tugas")).toBe(true);
    expect(isSafeInternalPath("/api/assess-files/abc.png")).toBe(true);
  });
  it("menolak javascript:, data:, dan //evil.com", () => {
    expect(isSafeInternalPath("javascript:alert(1)")).toBe(false);
    expect(isSafeInternalPath("data:text/html,x")).toBe(false);
    expect(isSafeInternalPath("//evil.com")).toBe(false);
    expect(isSafeInternalPath("https://evil.com")).toBe(false);
  });
});

describe("isSafeExternalUrl", () => {
  it("hanya http(s)", () => {
    expect(isSafeExternalUrl("https://a.com")).toBe(true);
    expect(isSafeExternalUrl("http://a.com")).toBe(true);
    expect(isSafeExternalUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeExternalUrl("ftp://a.com")).toBe(false);
    expect(isSafeExternalUrl("bukan-url")).toBe(false);
  });
});

describe("isSafeMediaSrc", () => {
  it("hanya prefix same-origin file terotorisasi", () => {
    expect(isSafeMediaSrc("/api/assess-files/q1/vid.mp4")).toBe(true);
    expect(isSafeMediaSrc("/api/task-files/t1/dok.pdf")).toBe(true);
    expect(isSafeMediaSrc("https://cdn.evil.com/x.png")).toBe(false);
    expect(isSafeMediaSrc("data:image/png;base64,x")).toBe(false);
  });
});

describe("closeUnbalancedMarkdown (mode streaming)", () => {
  it("menutup ** yang belum berpasangan", () => {
    expect(closeUnbalancedMarkdown("**belum tertutup")).toBe("**belum tertutup**");
  });
  it("menutup ` inline code ganjil", () => {
    expect(closeUnbalancedMarkdown("kode `x + 1")).toBe("kode `x + 1`");
  });
  it("menutup blok kode ``` ganjil", () => {
    const out = closeUnbalancedMarkdown("```js\nconsole.log(1)");
    expect((out.match(/```/g) ?? []).length % 2).toBe(0);
  });
  it("menutup [ tautan yang belum ditutup", () => {
    const out = closeUnbalancedMarkdown("lihat [dokumentasi");
    expect(out).toContain("](");
  });
  it("teks seimbang tidak diubah", () => {
    expect(closeUnbalancedMarkdown("**a *b* c**")).toBe("**a *b* c**");
    expect(closeUnbalancedMarkdown("A & B")).toBe("A & B");
    expect(closeUnbalancedMarkdown("plain text")).toBe("plain text");
  });
  it("bold berpasangan lengkap tidak menambah apa pun", () => {
    expect(closeUnbalancedMarkdown("**x** dan **y**")).toBe("**x** dan **y**");
  });
});

describe("tidyTruncated (finish_reason=length)", () => {
  it("memotong di kalimat utuh terakhir dan menutup markdown", () => {
    const out = tidyTruncated("Fotosintesis adalah proses penting. Tanaman membutuhkan cahaya **dan");
    expect(out).toMatch(/\.$/);
    expect((out.match(/\*\*/g) ?? []).length % 2).toBe(0);
  });
  it("membiarkan teks pendek utuh", () => {
    expect(tidyTruncated("Halo!")).toBe("Halo!");
  });
});

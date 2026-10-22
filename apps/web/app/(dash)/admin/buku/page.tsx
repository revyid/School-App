"use client";

// Admin sekolah: kelola buku sekolah (tautan, markdown, unggah file) lewat Sheet.
import { useState } from "react";
import { useFetch } from "@/app/lib/api";
import BookManagerSheet, { type SchoolBook } from "@/components/BookManagerSheet";
import { PageHead } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function BukuAdminPage() {
  const { data, reload, loading } = useFetch<{ rows: SchoolBook[] }>("/api/books?scope=school&perPage=100");
  const [open, setOpen] = useState(false);

  return (
    <>
      <PageHead kicker="Perpustakaan" title="Buku sekolah" desc="Tambahkan buku dari tautan, tempel materi markdown, atau unggah file ebook." />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="m-0 text-sm text-muted">Kelola koleksi buku sekolah beserta sampul dan status terbitnya.</p>
          <Button variant="sticker" onClick={() => setOpen(true)}>
            Kelola buku
          </Button>
        </div>
      </Card>

      <BookManagerSheet
        open={open}
        onOpenChange={setOpen}
        books={data?.rows ?? []}
        loading={loading}
        canManage
        onChanged={() => void reload()}
      />
    </>
  );
}

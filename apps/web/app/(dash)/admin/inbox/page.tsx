"use client";

// Admin: reveal pengirim anonim (tercatat audit) + daftar thread.
import { useState } from "react";
import { api, useFetch } from "@/app/lib/api";
import { PageHead, Panel, WarmTable, warmCell, Note } from "@/components/DashUI";
import { Button } from "@/components/ui/button";
import { Badge, statusVariant } from "@/components/ui/badge";

export default function CollabAdminPage() {
  const { data, loading, reload } = useFetch<{ rows: { id: string; subject: string; anonymous: boolean; sender: string; revealed: boolean }[] }>(
    "/api/collab",
  );
  const [msg, setMsg] = useState<string | null>(null);

  async function reveal(id: string) {
    const res = await api(`/api/collab/${id}/reveal`, { method: "POST" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(d.error || `Gagal (${res.status})`);
    else {
      setMsg(`Pengirim: ${d.sender?.name ?? "?"}`);
      reload();
    }
  }

  return (
    <>
      <PageHead kicker="Komunikasi" title="Inbox kolaborasi" desc="Reveal hanya untuk pesan anonim dan selalu tercatat di audit log." />
      <Panel>
        {loading && <Note>Memuat…</Note>}
        {msg && <p style={{ fontWeight: 700 }}>{msg}</p>}
        {data && data.rows.length === 0 && <Note>Belum ada thread.</Note>}
        {data && data.rows.length > 0 && (
          <WarmTable head={["Subjek", "Pengirim", "Status", ""]}>
            {data.rows.map((t) => (
              <tr key={t.id}>
                <td style={warmCell({ fontWeight: 700 })}>{t.subject}</td>
                <td style={warmCell()}>{t.sender}</td>
                <td style={warmCell()}>
                  {t.anonymous ? <Badge variant={statusVariant(t.revealed ? "AKTIF" : "PENDING")}>{t.revealed ? "revealed" : "anonim"}</Badge> : <Badge variant={statusVariant("AKTIF")}>terbuka</Badge>}
                </td>
                <td style={warmCell()}>
                  {t.anonymous && !t.revealed && (
                    <Button variant="sticker-ghost" type="button" onClick={() => reveal(t.id)}>Reveal pengirim</Button>
                  )}
                </td>
              </tr>
            ))}
          </WarmTable>
        )}
      </Panel>
    </>
  );
}

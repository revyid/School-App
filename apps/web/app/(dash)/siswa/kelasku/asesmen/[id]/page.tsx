"use client";

// Siswa: kerjakan asesmen per-ID dari Kelasku + review read-only + chart + cetak PDF.
import { use, useState } from "react";
import Link from "next/link";
import AssessChart from "@/components/AssessChart";
import { api, useFetch } from "@/app/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Glyph } from "@/components/Glyph";
import { PageHead } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface Q {
  id: string; type: "MCQ" | "SORTING"; stem: string; imageUrl: string | null; videoUrl: string | null; options: string[];
}
interface RQSort { id: string; type: "SORTING"; stem: string; imageUrl: string | null; videoUrl: string | null; correctSeq: string[]; pickedSeq: string[]; isCorrect: boolean; points: number; maxPoints: number }
interface RQMcq { id: string; type: "MCQ"; stem: string; imageUrl: string | null; videoUrl: string | null; options: string[]; pickedIndex: number | null; correctIndex: number | null; isCorrect: boolean; points: number; maxPoints: number }
type RQ = RQSort | RQMcq;
interface Result {
  submitted: boolean;
  attempt?: { id: string; score: number | null; maxScore: number | null; submittedAt: string };
  assessment?: { id: string; title: string; showChart: boolean };
  questions?: RQ[];
  stats?: { questionId: string; pct: number; n: number }[];
}

export default function AsesmenKerjakanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: aid } = use(params);
  const attempt = useFetch<{ attempt: { id: string; submittedAt: string | null; score?: number }; assessment: { title: string; showChart: boolean }; questions: Q[] }>(
    `/api/assessments/${aid}/attempt`,
  );
  const result = useFetch<Result>(
    attempt.data?.attempt.submittedAt ? `/api/assessments/${aid}/result` : null,
  );
  const [mcq, setMcq] = useState<Record<string, number>>({});
  const [sort, setSort] = useState<Record<string, string[]>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmKumpul, setConfirmKumpul] = useState(false);

  function move(qid: string, opts: string[], from: number, dir: -1 | 1) {
    const cur = sort[qid] ?? opts;
    const to = from + dir;
    if (to < 0 || to >= cur.length) return;
    const next = [...cur];
    [next[from], next[to]] = [next[to], next[from]];
    setSort({ ...sort, [qid]: next });
  }

  function kumpul() {
    if (!attempt.data || submitting) return;
    setConfirmKumpul(true);
  }

  function kumpulMsg(): string {
    if (!attempt.data) return "Kumpulkan jawaban? Setelah dikumpulkan tidak bisa diubah.";
    const total = attempt.data.questions.length;
    const dijawab = attempt.data.questions.filter((q) =>
      q.type === "MCQ" ? mcq[q.id] != null : true,
    ).length;
    const kosong = total - dijawab;
    return kosong > 0
      ? `Kamu menjawab ${dijawab} dari ${total} soal (${kosong} kosong). Tetap kumpulkan?`
      : `Kumpulkan ${total} jawaban? Setelah dikumpulkan tidak bisa diubah.`;
  }

  async function doKumpul() {
    if (!attempt.data || submitting) return;
    setConfirmKumpul(false);
    setSubmitting(true);
    const answers = attempt.data.questions.map((q) => {
      if (q.type === "MCQ") return { questionId: q.id, pickedIndex: mcq[q.id] ?? null };
      const cur = sort[q.id] ?? q.options;
      return { questionId: q.id, pickedOrder: cur.map((t) => q.options.indexOf(t)) };
    });
    try {
      const res = await api(`/api/assessments/${aid}/attempt`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setMsg(d.error || `Gagal (${res.status})`);
      else {
        setMsg(`Terkumpul! Skor: ${d.score}/${d.maxScore}`);
        attempt.reload();
      }
    } finally {
      setSubmitting(false);
    }
  }

  const showChart = result.data?.assessment?.showChart ?? attempt.data?.assessment.showChart ?? false;

  return (
    <>
      <PageHead className="font-bold text-[13px]" kicker="Ujian" title={attempt.data?.assessment.title ?? "Asesmen"} desc="Kerjakan dengan jujur. Soal diacak per siswa, nilai keluar otomatis."
        right={<Link href="/siswa/kelasku">Kembali ke Kelasku</Link>}
      />
      {attempt.loading && !attempt.data && (
        <div className="divide-y divide-line">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 px-1 py-3">
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-7 w-16 rounded-full" />
            </div>
          ))}
        </div>
      )}
      {attempt.error && <Alert variant="destructive">Gagal: {attempt.error}</Alert>}
      {attempt.data && (
        <Card>
          <div className="mb-4 flex flex-wrap items-center gap-2.5">
            <h2 className="display text-xl m-0 flex-1">{attempt.data.assessment.title}</h2>
            {attempt.data.attempt.submittedAt && <Button className="bg-ink text-cream" variant="sticker"  type="button" onClick={() => window.print()}>Cetak PDF</Button>}
          </div>
          {attempt.data.attempt.submittedAt ? (
            <>
              <Alert>Sudah dikumpulkan{attempt.data.attempt.score != null ? `, skor: ${attempt.data.attempt.score}` : ""}. Hasil di bawah read-only, tidak bisa diubah.</Alert>
              {result.data?.submitted && (
                <>
                  {result.data.questions?.map((q, qi) => (
                    <div key={q.id} className={cn("mb-[18px] p-[14px] border border-line rounded-2xl", q.isCorrect ? "bg-sage" : "bg-cream")}>
                      <p className="font-bold mt-0 mr-0 mb-[10px] ml-0">{qi + 1}. {q.stem}</p>
                      {q.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img className="max-w-full rounded-xl mb-[10px]" src={q.imageUrl} alt="gambar soal" />
                      )}
                      {q.videoUrl && (
                        // eslint-disable-next-line jsx-a11y/media-has-caption
                        <video className="max-w-full rounded-xl mb-[10px]" src={q.videoUrl} controls preload="metadata" />
                      )}
                      {q.type === "MCQ" ? (
                        <ul className="list-none m-0 p-0 grid gap-[6px]">
                          {q.options.map((o, i) => {
                            const benar = i === q.correctIndex;
                            const dipilih = i === q.pickedIndex;
                            return (
                              <li key={i} className={cn(
                                "rounded-xl px-3 py-[9px] border",
                                benar ? "border-2 border-olive-deep bg-mint-soft font-bold"
                                  : dipilih ? "border-line bg-blush font-bold"
                                  : "border-line bg-cream",
                              )}>
                                <span>{o}</span>
                                {benar && <span className="ml-2 text-xs text-olive-deep">✓ benar</span>}
                                {!benar && dipilih && <span className="ml-2 text-xs text-terracotta-deep">✗ jawabanmu</span>}
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <div className="grid gap-[6px] text-[13px]">
                          <div><strong>Urutan benar:</strong> {q.correctSeq.join(" → ")}</div>
                          <div><strong>Jawabanmu:</strong> {q.pickedSeq.join(" → ")}</div>
                        </div>
                      )}
                    </div>
                  ))}
                  {showChart && result.data.stats && result.data.stats.length > 0 && (
                    <div className="mt-2 max-w-[720px]">
                      <h3 className="display text-base mt-0 mr-0 mb-2 ml-0">Chart kelas: persentase benar per soal</h3>
                      <AssessChart
                        labels={result.data.stats.map((_, i) => `Soal ${i + 1}`)}
                        pcts={result.data.stats.map((s) => s.pct)}
                        counts={result.data.stats.map((s) => s.n)}
                      />
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              {attempt.data.questions.map((q, qi) => (
                <div className="mb-[18px] p-[14px] border border-solid border-line rounded-2xl" key={q.id}>
                  <p className="font-bold mt-0 mr-0 mb-[10px] ml-0">{qi + 1}. {q.stem}</p>
                  {q.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="max-w-full rounded-xl mb-[10px]" src={q.imageUrl} alt="gambar soal" />
                  )}
                  {q.videoUrl && (
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    <video className="max-w-full rounded-xl mb-[10px]" src={q.videoUrl} controls preload="metadata" />
                  )}
                  {q.type === "MCQ" ? (
                    <ul className="list-none m-0 p-0 grid gap-[6px]">
                      {q.options.map((o, i) => (
                        <li key={i}>
                          <label className={cn("flex items-start gap-[10px] px-3 py-[9px] rounded-xl border border-line cursor-pointer", mcq[q.id] === i ? "bg-paper-deep" : "bg-cream")}>
                            <input
                              type="radio" name={q.id} checked={mcq[q.id] === i}
                              onChange={() => setMcq({ ...mcq, [q.id]: i })}
                            /> <span>{o}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <ol className="m-0 pl-5 grid gap-[6px]">
                      {(sort[q.id] ?? q.options).map((o, i) => (
                        <li className="flex gap-2 items-center" key={`${o}-${i}`}>
                          <span className="flex-1">{o}{" "}</span>
                          <Button variant="sticker-ghost" type="button" onClick={() => move(q.id, q.options, i, -1)}><Glyph name="arrowUp" size={14} /></Button>
                          <Button variant="sticker-ghost" type="button" onClick={() => move(q.id, q.options, i, 1)}><Glyph name="arrowDown" size={14} /></Button>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              ))}
              <div className="mb-4 flex flex-wrap items-center gap-2.5">
                <Button variant="sticker" type="button" onClick={kumpul} disabled={submitting}>{submitting ? "Mengumpulkan…" : "Kumpulkan jawaban"}</Button>
              </div>
            </>
          )}
        </Card>
      )}
      {msg && <p className="font-bold">{msg}</p>}
      <ConfirmDialog
        open={confirmKumpul}
        title="Kumpulkan Jawaban"
        message={kumpulMsg()}
        confirmLabel="Kumpulkan"
        onConfirm={doKumpul}
        onCancel={() => setConfirmKumpul(false)}
      />
    </>
  );
}

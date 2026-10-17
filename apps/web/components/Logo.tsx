// Wordmark SMS-LMS / Nama Sekolah: matahari kecil + teks (teks di HTML, bukan gambar).
// Bila `src` diisi (logo sekolah dari /api/portal/logo), gambar logo dipakai.
import { cn } from "@/lib/utils";

export default function Logo({
  compact = false,
  light = false,
  src = null as string | null,
  name,
}: {
  compact?: boolean;
  light?: boolean;
  src?: string | null;
  name?: string;
}) {
  const displayText = name || "sms-lms";
  const isCustomName = Boolean(name && name.toLowerCase() !== "sms-lms");

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", light ? "text-cream" : "text-ink")}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="shrink-0 rounded-lg object-cover" src={src} alt={displayText} width={compact ? 24 : 28} height={compact ? 24 : 28} />
      ) : (
        <svg className="shrink-0" width={compact ? 24 : 28} height={compact ? 24 : 28} viewBox="0 0 32 32" aria-hidden="true">
          <circle cx="16" cy="18" r="9" fill="none" stroke="currentColor" strokeWidth="2.4" />
          <circle cx="16" cy="18" r="3.2" className="fill-terracotta" />
          <g stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="16" y1="2.5" x2="16" y2="6" />
            <line x1="7.5" y1="5.5" x2="10" y2="8" />
            <line x1="24.5" y1="5.5" x2="22" y2="8" />
          </g>
        </svg>
      )}
      <span className={cn("overflow-hidden text-ellipsis whitespace-nowrap font-extrabold tracking-[-0.04em]", compact ? "text-base" : "text-[18px]")}>
        {isCustomName ? (
          displayText
        ) : (
          <>
            sms<span className="text-terracotta">-lms</span>
          </>
        )}
      </span>
    </span>
  );
}

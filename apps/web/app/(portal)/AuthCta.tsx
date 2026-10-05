"use client";

// Tombol masuk adaptif: guest -> "/login" bertuliskan Masuk,
// user login -> dasbor perannya bertuliskan "Buka dasbor".
import { ROLE_HOME } from "@sms/shared/auth";
import { useFetch } from "@/app/lib/api";

const HOME: Record<string, string> = { ...(ROLE_HOME as Record<string, string>), SUPER_ADMIN: "/pantau" };

export default function AuthCta({
  className,
  style,
  loginLabel = "Masuk ↗",
  dashLabel = "Buka dasbor ↗",
}: {
  className?: string;
  style?: React.CSSProperties;
  loginLabel?: string;
  dashLabel?: string;
}) {
  const me = useFetch<{ user?: { role?: string } }>("/api/auth/me");
  const role = me.data?.user?.role;
  const href = role && HOME[role] ? HOME[role] : "/login";
  const label = role && HOME[role] ? dashLabel : loginLabel;
  return (
    <a href={href} className={className} style={style}>
      {label}
    </a>
  );
}

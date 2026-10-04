import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requirePage } from "@/app/lib/require-page";
import Bell from "@/components/Bell";

// /change-password PINDAH ke app/change-password (di luar grup ini), jadi
// redirect di bawah tidak pernah loop. Enforcement tetap di authorize().
export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const c = await cookies();
  const a = await requirePage({
    host: h.get("host") ?? "",
    token: c.get(SESSION_COOKIE)?.value,
    pathname: h.get("x-pathname") ?? "/",
  });
  if (!a.ok) redirect(a.redirectTo);
  const me = a.me;
  return (
    <div>
      <header>
        <span>{a.schoolName}</span> · <span>{me.name}</span> · <span>{me.role}</span> · <Bell />
      </header>
      <main>{children}</main>
    </div>
  );
}

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requirePage } from "@/app/lib/require-page";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const c = await cookies();
  const a = await requirePage({
    host: h.get("host") ?? "",
    token: c.get(SESSION_COOKIE)?.value,
    pathname: "/admin",
    roles: ["ADMIN"],
  });
  if (!a.ok) redirect(a.redirectTo);
  return <>{children}</>;
}

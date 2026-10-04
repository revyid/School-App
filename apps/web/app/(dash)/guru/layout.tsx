import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requirePage } from "@/app/lib/require-page";

export default async function GuruLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const c = await cookies();
  const a = await requirePage({
    host: h.get("host") ?? "",
    token: c.get(SESSION_COOKIE)?.value,
    pathname: "/guru",
    roles: ["GURU"],
  });
  if (!a.ok) redirect(a.redirectTo);
  return <>{children}</>;
}

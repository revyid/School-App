import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, ROLE_HOME } from "@sms/shared/auth";
import { authorize } from "@/server/auth-gate";

export default async function HomePage() {
  const h = await headers();
  const c = await cookies();
  const a = await authorize({
    host: h.get("host") ?? "",
    token: c.get(SESSION_COOKIE)?.value,
    pathname: "/",
  });
  if (!a.ok) redirect("/login");
  redirect(a.mustChangePassword ? "/change-password" : (ROLE_HOME[a.role as keyof typeof ROLE_HOME] ?? "/siswa"));
}

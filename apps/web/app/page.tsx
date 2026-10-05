import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, ROLE_HOME } from "@sms/shared/auth";
import { authorize } from "@/server/auth-gate";
import PortalPage from "./(portal)/page";

// Root "/" = landing publik per sekolah (tanpa login).
// User yang SUDAH login langsung diarahkan ke dasbor perannya.
export default async function HomePage() {
  const h = await headers();
  const c = await cookies();
  const token = c.get(SESSION_COOKIE)?.value;
  if (token) {
    const a = await authorize({
      host: h.get("host") ?? "",
      token,
      pathname: "/",
    });
    if (a.ok) {
      redirect(
        a.mustChangePassword
          ? "/change-password"
          : (ROLE_HOME[a.role as keyof typeof ROLE_HOME] ?? "/siswa"),
      );
    }
  }
  return <PortalPage />;
}

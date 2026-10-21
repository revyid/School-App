import { headers } from "next/headers";
import AdminDashboard from "./dashboard";
import AdminLoginPage from "@/app/admin-login/page";
import { isRootHost } from "@lacakedu/shared/school";

// /admin: di subdomain sekolah = dasbor admin sekolah, di apex = login root.
export default async function AdminPage() {
  const h = await headers();
  const bare = (h.get("host") ?? "").split(":")[0].trim().toLowerCase();
  const apex = process.env.APEX_DOMAIN ?? "domainmu.id";
  const isRoot = isRootHost(bare, apex);
  return isRoot ? <AdminLoginPage /> : <AdminDashboard />;
}

import { headers } from "next/headers";
import PortalHome from "./PortalHome";
import LandingPage from "../beranda/page";

// "/" milik sekolah; di apex "/" = landing platform.
export default async function Page() {
  const h = await headers();
  const bare = (h.get("host") ?? "").split(":")[0].trim().toLowerCase();
  const apex = process.env.APEX_DOMAIN ?? "domainmu.id";
  const isRoot = bare === apex || bare === "localtest.me" || bare === "dev.revy.my.id";
  return isRoot ? <LandingPage /> : <PortalHome />;
}

import { headers } from "next/headers";
import PortalHome from "./PortalHome";
import LandingPage from "../beranda/page";
import { isRootHost } from "@sms/shared/school";

// "/" milik sekolah; di apex "/" = landing platform.
export default async function Page() {
  const h = await headers();
  const bare = (h.get("host") ?? "").split(":")[0].trim().toLowerCase();
  const apex = process.env.APEX_DOMAIN ?? "domainmu.id";
  const isRoot = isRootHost(bare, apex);
  return isRoot ? <LandingPage /> : <PortalHome />;
}

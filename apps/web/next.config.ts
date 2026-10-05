import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(dirname, "../.."),
  serverExternalPackages: ["argon2", "ioredis"],
  // Dev via subdomain *.localtest.me: izinkan HMR/dev resource lintas-origin ini.
  // (Prod tidak pakai next dev, jadi ini tidak berpengaruh di deploy.)
  allowedDevOrigins: ["*.localtest.me", "demo.localtest.me"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "covers.openlibrary.org" }],
  },
};

export default nextConfig;

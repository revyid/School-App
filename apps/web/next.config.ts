import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  serverExternalPackages: ["argon2", "ioredis"],
  // Dev via subdomain *.localtest.me: izinkan HMR/dev resource lintas-origin ini.
  // (Prod tidak pakai next dev, jadi ini tidak berpengaruh di deploy.)
  allowedDevOrigins: ["*.localtest.me", "demo.localtest.me"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "covers.openlibrary.org" }],
  },
  // Socket.io worker (realtime att:scan + notif:new) diekspos satu origin
  // agar browser tidak perlu konek langsung ke port worker.
  async rewrites() {
    const workerPort = process.env.WORKER_PORT ?? "3201";
    return [
      {
        source: "/socket.io/:path*",
        destination: `http://127.0.0.1:${workerPort}/socket.io/:path*`,
      },
    ];
  },
};

export default nextConfig;

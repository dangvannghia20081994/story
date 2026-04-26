import { log } from "console";
import type { NextConfig } from "next";

function stripTrailingSlash(s: string | undefined): string {
  return s?.replace(/\/$/, "") ?? "";
}

const backend =
  stripTrailingSlash(process.env.API_URL) ||
  stripTrailingSlash(process.env.NEXT_PUBLIC_API_URL) ||
  "http://localhost:8000";
  console.log("backend", backend);

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${backend}/api/:path*` },
      { source: "/storage/:path*", destination: `${backend}/storage/:path*` },
    ];
  },
};

export default nextConfig;

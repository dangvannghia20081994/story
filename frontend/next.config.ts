import type { NextConfig } from "next";

function stripTrailingSlash(s: string | undefined): string {
  return s?.replace(/\/$/, "") ?? "";
}

const backend =
  stripTrailingSlash(process.env.API_URL) ||
  stripTrailingSlash(process.env.NEXT_PUBLIC_API_URL) ||
  "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backend}/api/:path*` }];
  },
};

export default nextConfig;

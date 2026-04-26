import type { NextConfig } from "next";

function stripTrailingSlash(s: string | undefined): string {
  return s?.replace(/\/$/, "") ?? "";
}

const backend =
  stripTrailingSlash(process.env.API_URL) ||
  stripTrailingSlash(process.env.NEXT_PUBLIC_API_URL) ||
  "http://localhost:8000";

const nextConfig: NextConfig = {
  // Dev: cho phép truy cập qua reverse proxy (nginx) với Host story.test — tránh 502 / chặn asset dev
  allowedDevOrigins: ["story.test", "www.story.test"],
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${backend}/api/:path*` },
      { source: "/storage/:path*", destination: `${backend}/storage/:path*` },
    ];
  },
};

export default nextConfig;

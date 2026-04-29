import type { NextConfig } from "next";

function stripTrailingSlash(s: string | undefined): string {
  return s?.replace(/\/$/, "") ?? "";
}

const backend =
  stripTrailingSlash(process.env.API_URL) ||
  stripTrailingSlash(process.env.NEXT_PUBLIC_API_URL) ||
  "http://localhost:8000";

/** Slug cấp 1: không trùng route tĩnh / từ khóa dành riêng (tránh khớp /stories/... khi strip prefix). */
const storySeg = ":story((?!^(?:stories|about|members|rankings|api|_next|favicon.ico)$)[^/]+)";
const chapterSeg = ":chapter([^/]+)";

const nextConfig: NextConfig = {
  // Dev: cho phép truy cập qua reverse proxy (nginx) với Host story.test — tránh 502 / chặn asset dev
  allowedDevOrigins: ["story.test", "www.story.test"],
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/api/:path*", destination: `${backend}/api/:path*` },
        { source: "/storage/:path*", destination: `${backend}/storage/:path*` },
      ],
      // URL ngắn (không /stories) → route trong app/stories/... — thứ tự: pattern dài/specific trước.
      afterFiles: [
        { source: `/${storySeg}/${chapterSeg}/read`, destination: "/stories/:story/:chapter/read" },
        { source: `/${storySeg}/${chapterSeg}/listen-audio`, destination: "/stories/:story/:chapter/listen-audio" },
        { source: `/${storySeg}/${chapterSeg}/listen`, destination: "/stories/:story/:chapter/listen" },
        { source: `/${storySeg}/characters`, destination: "/stories/:story/characters" },
        { source: `/${storySeg}`, destination: "/stories/:story" },
      ],
    };
  },
};

export default nextConfig;

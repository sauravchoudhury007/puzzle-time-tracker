import type { NextConfig } from "next";

const supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Highlight reel: signed links into this project's private avatar bucket only.
      { protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/sign/avatar/**" },
      // Stand-in reel for when the photos cannot be loaded.
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
    ],
    // Storage answers `no-cache`, which would otherwise keep a resized photo for only 60s.
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
};

export default nextConfig;

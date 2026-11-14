import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Sample deals use local files in /public. Live Rakuten Product Search
    // `imageurl` values are merchant-hosted, so product photos render
    // unoptimized and these patterns cover the affiliate hosts we know.
    remotePatterns: [
      { protocol: "https", hostname: "**.rakuten.com", pathname: "/**" },
      { protocol: "https", hostname: "**.rakutenadvertising.com", pathname: "/**" },
      { protocol: "https", hostname: "**.linksynergy.com", pathname: "/**" },
      { protocol: "http", hostname: "**.rakuten.com", pathname: "/**" },
      { protocol: "http", hostname: "**.linksynergy.com", pathname: "/**" },
    ],
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

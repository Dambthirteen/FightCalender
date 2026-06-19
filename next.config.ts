import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // web-push nutzt Node-Module und soll nicht gebündelt werden.
  serverExternalPackages: ["web-push"],
  async headers() {
    return [
      {
        // Service Worker nie cachen, korrekt als JS ausliefern.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;

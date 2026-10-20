import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // cloudflared quick tunnel hostnames change on each run.
  allowedDevOrigins: ["127.0.0.1", "*.trycloudflare.com"],
  async headers() {
    return ["/city/:path*", "/city-rebuild-v002/:path*", "/city-rebuild-v002-test/:path*", "/unity-preview/:path*"].map(source => ({
      source,
      headers: [{ key: "Cache-Control", value: "no-cache, must-revalidate" }],
    }));
  },
};

export default nextConfig;

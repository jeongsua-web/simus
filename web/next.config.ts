import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cloudflared quick tunnel hostnames change on each run.
  allowedDevOrigins: ["127.0.0.1", "*.trycloudflare.com"],
  async headers() {
    return ["/city/:path*", "/unity-preview/:path*"].map(source => ({
      source,
      headers: [{ key: "Cache-Control", value: "no-cache, must-revalidate" }],
    }));
  },
};

export default nextConfig;

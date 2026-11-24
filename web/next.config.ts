import type { NextConfig } from "next";
import { V003_BUILD_BASE } from "./src/lib/city/city-builds";

const nextConfig: NextConfig = {
  output: "standalone",
  // cloudflared quick tunnel hostnames change on each run.
  allowedDevOrigins: ["127.0.0.1", "*.trycloudflare.com"],
  async headers() {
    return [{
      source: `${V003_BUILD_BASE}/:path*`,
      headers: [{ key: "Cache-Control", value: "no-cache, must-revalidate" }],
    }];
  },
};

export default nextConfig;

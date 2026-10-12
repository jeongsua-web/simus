import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cloudflared quick tunnel hostnames change on each run.
  allowedDevOrigins: ["127.0.0.1", "*.trycloudflare.com"],
};

export default nextConfig;

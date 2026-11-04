import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  images: {
    remotePatterns: [],
  },
  env: {
    VHAGAR_API_URL: process.env.VHAGAR_API_URL || "http://localhost:8001",
  },
};

export default nextConfig;

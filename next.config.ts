import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Line-item reference photos are posted as compressed data URLs, so the
  // default 1 MB Server Action body limit is too tight for a section-sized save.
  experimental: {
    serverActions: { bodySizeLimit: "8mb" },
  },
};

export default nextConfig;

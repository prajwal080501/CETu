import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Admin PDF uploads flow through server actions; raise the 1 MB default so
  // real cutoff/placement PDFs (up to our 25 MB cap) aren't rejected.
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;

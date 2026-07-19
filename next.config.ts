import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Admin PDF uploads flow through server actions; raise the 1 MB default so
  // real cutoff/placement PDFs (up to our 25 MB cap) aren't rejected.
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
    // Optimize dynamic imports
    optimizePackageImports: ["lucide-react", "@/components/ui"],
  },
  // Top-level React Compiler config (not under experimental for v16.2)
  reactCompiler: false, // Disable for now - requires babel-plugin-react-compiler
  // Optimize images with Next.js Image Optimization
  images: {
    unoptimized: false,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  // Code splitting optimizations
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },
  // Compress static assets
  compress: true,
  // PoweredByHeader disabled for security
  poweredByHeader: false,
  // Optimize production builds
  productionBrowserSourceMaps: false,
};

export default nextConfig;

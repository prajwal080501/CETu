import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Admin PDF uploads flow through server actions; raise the 1 MB default so
  // real cutoff/placement PDFs (up to our 25 MB cap) aren't rejected.
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
    // Tree-shake heavy barrel imports so only used icons/chart parts ship.
    optimizePackageImports: ["lucide-react", "recharts", "@base-ui/react"],
  },
  // Auto-memoize components/hooks at build time (React 19 + Next 16) — removes
  // most manual memo/useMemo/useCallback and cuts client re-renders.
  reactCompiler: true,
  // Drop console.* (keep error/warn) from production client bundles.
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["error", "warn"] }
        : false,
  },
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

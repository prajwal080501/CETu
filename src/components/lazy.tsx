/**
 * Dynamic Component Wrapper for Code Splitting
 * 
 * Use this pattern for lazy-loading heavy components that are not critical
 * for initial page load. This reduces the main bundle and improves FCP/LCP.
 */

import dynamic from "next/dynamic";
import React from "react";

// Loading placeholder component
const ComponentSkeleton = ({ height = "h-96" }: { height?: string }) => (
  <div className={`${height} w-full bg-muted/30 animate-pulse rounded-lg`} />
);

/**
 * Lazy-load charts and visualizations
 * Used for: BranchGlobalHeatmap, BranchInsightHeatmap, CutoffTrend, CutoffMatrix
 */
export const LazyChart = dynamic(
  () => import("@/components/BranchGlobalHeatmap").then((m) => m.BranchGlobalHeatmap),
  {
    loading: () => <ComponentSkeleton />,
    ssr: true, // Keep true for SEO, set false if server-side rendering not needed
  }
);

/**
 * Lazy-load AI-powered features
 * Used for: AiInsights feature
 */
export const LazyAiInsights = dynamic(
  () => import("@/components/AiInsights").then((m) => m.AiInsights),
  {
    loading: () => <ComponentSkeleton height="h-64" />,
    ssr: false, // AI features typically client-side only
  }
);

/**
 * Lazy-load job market data
 * Used for: JobMarketPanel
 */
export const LazyJobMarketPanel = dynamic(
  () => import("@/components/JobMarketPanel").then((m) => m.JobMarketPanel),
  {
    loading: () => <ComponentSkeleton height="h-80" />,
    ssr: true,
  }
);

/**
 * Lazy-load predictor results (heavy calculations)
 * Used for: PredictorResults
 */
export const LazyPredictorResults = dynamic(
  () => import("@/components/PredictorResults").then((m) => m.PredictorResults),
  {
    loading: () => <ComponentSkeleton height="h-96" />,
    ssr: false,
  }
);

/**
 * Combine with Intersection Observer for viewport-based loading
 * 
 * Example Usage:
 * 
 * function Page() {
 *   const ref = useRef<HTMLDivElement>(null);
 *   const isVisible = useIntersectionObserver(ref);
 *
 *   return (
 *     <div ref={ref}>
 *       {isVisible && <LazyChart />}
 *     </div>
 *   );
 * }
 */

export default {
  LazyChart,
  LazyAiInsights,
  LazyJobMarketPanel,
  LazyPredictorResults,
  ComponentSkeleton,
};

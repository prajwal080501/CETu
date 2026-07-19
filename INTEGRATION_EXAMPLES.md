/**
 * PERFORMANCE OPTIMIZATION - INTEGRATION GUIDE
 * 
 * Practical examples showing how to use the performance optimizations
 * in your components and pages.
 */

/**
 * ============================================
 * EXAMPLE 1: List Pages with Memoized Items
 * ============================================
 * 
 * File: src/app/colleges/page.tsx
 */

import { CollegeCard } from "@/components/CollegeCard";
import { useState, useMemo } from "react";
import { useDebounce } from "@/lib/performance";

export default function CollegesPage() {
  const [searchTerm, setSearchTerm] = useState("");

  // Debounce search to avoid excessive filtering
  const debouncedSearch = useDebounce((term: string) => {
    // Trigger search query here
    console.log("Searching for:", term);
  }, 300);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    debouncedSearch(e.target.value);
  };

  // Memoize filtered results - prevents recalculation on re-renders
  const filteredColleges = useMemo(() => {
    return colleges.filter((c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, colleges]);

  return (
    <div>
      <input
        type="text"
        placeholder="Search colleges..."
        value={searchTerm}
        onChange={handleSearch}
      />

      {/* CollegeCard is already memoized - won't re-render unless props change */}
      <div className="grid grid-cols-3 gap-4">
        {filteredColleges.map((college, index) => (
          <CollegeCard
            key={college.slug}
            college={college}
            rank={index + 1}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * ============================================
 * EXAMPLE 2: Lazy Loading Heavy Components
 * ============================================
 * 
 * File: src/app/branches/page.tsx
 */

import { useRef } from "react";
import { useIntersectionObserver } from "@/lib/performance";
import { LazyChart, ComponentSkeleton } from "@/components/lazy";

export default function BranchesPage() {
  const chartRef = useRef<HTMLDivElement>(null);
  const isChartVisible = useIntersectionObserver(chartRef);

  return (
    <div>
      <h1>Branch Analytics</h1>

      {/* Chart only renders when scrolled into view */}
      <div ref={chartRef} className="mt-8">
        {isChartVisible ? (
          <LazyChart />
        ) : (
          <ComponentSkeleton height="h-96" />
        )}
      </div>
    </div>
  );
}

/**
 * ============================================
 * EXAMPLE 3: Form with Throttled Submission
 * ============================================
 * 
 * File: src/components/PredictorForm.tsx
 */

import { useCallback, useState } from "react";
import { useThrottle } from "@/lib/performance";

export function PredictorForm() {
  const [formData, setFormData] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmitting(true);
      try {
        const result = await fetch("/api/predict", {
          method: "POST",
          body: JSON.stringify(formData),
        });
        // Handle result
      } finally {
        setIsSubmitting(false);
      }
    },
    [formData]
  );

  // Throttle form submission - prevent spam clicking
  const throttledSubmit = useThrottle(handleSubmit, 500);

  return (
    <form onSubmit={throttledSubmit}>
      {/* Form fields */}
      <button disabled={isSubmitting}>
        {isSubmitting ? "Calculating..." : "Predict"}
      </button>
    </form>
  );
}

/**
 * ============================================
 * EXAMPLE 4: Data Visualization with Memoization
 * ============================================
 * 
 * File: src/components/CutoffChart.tsx
 */

import { useMemo, useCallback, memo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";

interface ChartProps {
  data: Array<{ year: number; cutoff: number }>;
  onDataPointClick: (year: number) => void;
}

const CutoffChartBase = memo(
  function CutoffChart({ data, onDataPointClick }: ChartProps) {
    // Memoize data transformation - expensive calculation
    const processedData = useMemo(() => {
      return data.map((d) => ({
        ...d,
        trend: calculateTrend(d.year, data),
      }));
    }, [data]);

    // Stable callback for chart click handler
    const handleClick = useCallback(
      (payload: any) => {
        onDataPointClick(payload.year);
      },
      [onDataPointClick]
    );

    return (
      <LineChart width={800} height={400} data={processedData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="year" />
        <YAxis />
        <Line
          type="monotone"
          dataKey="cutoff"
          stroke="#8884d8"
          onClick={handleClick}
        />
      </LineChart>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison - only re-render if data array reference changes
    return prevProps.data === nextProps.data;
  }
);

export default CutoffChartBase;

/**
 * ============================================
 * EXAMPLE 5: Dynamic Component Loading
 * ============================================
 * 
 * File: src/app/employers/page.tsx
 */

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { ComponentSkeleton } from "@/components/lazy";

// Code-split heavy employer components
const EmployerFilters = dynamic(
  () => import("@/components/EmployerFilters"),
  { loading: () => <ComponentSkeleton /> }
);

const EmployerList = dynamic(() => import("@/components/EmployerList"), {
  loading: () => <ComponentSkeleton height="h-96" />,
  ssr: true,
});

const JobMarketAnalytics = dynamic(
  () => import("@/components/JobMarketAnalytics"),
  { loading: () => <ComponentSkeleton height="h-80" />, ssr: false }
);

export default function EmployersPage() {
  return (
    <div className="space-y-8">
      <h1>Top Employers</h1>

      <Suspense fallback={<ComponentSkeleton />}>
        <EmployerFilters />
      </Suspense>

      <Suspense fallback={<ComponentSkeleton height="h-96" />}>
        <EmployerList />
      </Suspense>

      <Suspense fallback={<ComponentSkeleton height="h-80" />}>
        <JobMarketAnalytics />
      </Suspense>
    </div>
  );
}

/**
 * ============================================
 * EXAMPLE 6: Preventing Layout Shift
 * ============================================
 * 
 * File: src/components/LoadingCard.tsx
 */

import { useState } from "react";
import { Card } from "@/components/ui/card";

export function LoadingCard({ data }: { data: any | null }) {
  const [isLoading, setIsLoading] = useState(!data);

  return (
    // Reserve space to prevent layout shift
    <Card className="h-64 p-4">
      {isLoading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-300 rounded w-3/4" />
          <div className="h-4 bg-gray-300 rounded" />
          <div className="h-4 bg-gray-300 rounded w-5/6" />
        </div>
      ) : (
        <div>
          <h3>{data.title}</h3>
          <p>{data.description}</p>
        </div>
      )}
    </Card>
  );
}

/**
 * ============================================
 * EXAMPLE 7: Theme Switching (CSS Variables)
 * ============================================
 * 
 * File: src/components/ThemeToggle.tsx
 * 
 * Performance: Theme switches instantly with NO React re-renders!
 */

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="p-2 rounded-lg hover:bg-muted"
      // CSS variables update instantly at :root level
      // No component re-renders needed!
    >
      {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}

// CSS (globals.css) - Already optimized with CSS variables:
// :root { --color-primary: oklch(...) }
// .dark { --color-primary: oklch(...) }
// .themed-element { color: var(--color-primary) }

/**
 * ============================================
 * EXAMPLE 8: Scroll-Based Lazy Loading
 * ============================================
 * 
 * File: src/components/InfiniteCollegeList.tsx
 */

import { useRef, useState, useEffect, useCallback } from "react";
import { useIntersectionObserver } from "@/lib/performance";
import { CollegeCard } from "@/components/CollegeCard";

export function InfiniteCollegeList() {
  const [colleges, setColleges] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isBottomVisible = useIntersectionObserver(bottomRef);

  // Load more when bottom becomes visible
  useEffect(() => {
    if (isBottomVisible) {
      loadMore();
    }
  }, [isBottomVisible]);

  const loadMore = useCallback(async () => {
    const result = await fetch(`/api/colleges?page=${page}`);
    const newColleges = await result.json();
    setColleges((prev) => [...prev, ...newColleges]);
    setPage((prev) => prev + 1);
  }, [page]);

  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        {colleges.map((college) => (
          <CollegeCard key={college.slug} college={college} />
        ))}
      </div>

      {/* Loading trigger - appears when user scrolls to bottom */}
      <div ref={bottomRef} className="h-20 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    </>
  );
}

/**
 * ============================================
 * EXAMPLE 9: useCallback for Event Handlers
 * ============================================
 * 
 * File: src/components/FilteredList.tsx
 */

import { useCallback, useState, useMemo } from "react";
import { useStableCallback } from "@/lib/performance";

interface Item {
  id: string;
  name: string;
  category: string;
}

export function FilteredList({ items }: { items: Item[] }) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Stable callback - same reference across renders
  // Safe to pass to memoized child components
  const handleCategoryClick = useStableCallback(
    (category: string) => {
      setSelectedCategory(selectedCategory === category ? null : category);
    },
    [selectedCategory]
  );

  // Memoized filtered results
  const filtered = useMemo(() => {
    if (!selectedCategory) return items;
    return items.filter((item) => item.category === selectedCategory);
  }, [items, selectedCategory]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {["All", "Government", "Private", "Autonomous"].map((cat) => (
          <button
            key={cat}
            onClick={() => handleCategoryClick(cat)}
            className={`px-4 py-2 rounded ${
              selectedCategory === cat ? "bg-primary text-white" : "bg-muted"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {filtered.map((item) => (
          <ItemCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

/**
 * ============================================
 * CHECKLIST: Before Deploying Performance Features
 * ============================================
 * 
 * ✅ Build completes without errors
 * ✅ No console errors in dev or production
 * ✅ All memoized components receive stable props
 * ✅ useCallback dependencies are correct
 * ✅ useMemo dependencies are correct
 * ✅ Lazy components have loading states
 * ✅ Theme switching works smoothly
 * ✅ Mobile performance is good
 * ✅ Network DevTools shows no duplicate requests
 * ✅ React DevTools Profiler shows reduced renders
 */

/**
 * ============================================
 * DEBUGGING & MONITORING
 * ============================================
 * 
 * React DevTools:
 * 1. Open React DevTools → Profiler tab
 * 2. Record a user interaction
 * 3. Look for:
 *    - Unnecessary re-renders (should be ~50% less)
 *    - Render duration (should be shorter)
 *    - Component hierarchy (memoized items highlighted)
 * 
 * Chrome DevTools:
 * 1. Open Performance tab
 * 2. Record user interaction
 * 3. Check for:
 *    - Long tasks (should be <50ms)
 *    - Layout thrashing (should be minimal)
 *    - JavaScript execution time
 * 
 * Lighthouse:
 * 1. Open Lighthouse tab
 * 2. Run audit
 * 3. Target metrics:
 *    - FCP: < 1.8s
 *    - LCP: < 2.5s
 *    - CLS: < 0.1
 *    - TTI: < 3.8s
 */

export {};

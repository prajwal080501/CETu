# Performance Optimization Guide

This document outlines the performance optimizations implemented across the CETu application.

## Summary of Optimizations

### 1. **React Compiler & Automatic Memoization** (`next.config.ts`)

✅ **Enabled React Compiler** - Next.js 16.2.10 experimental feature for automatic function memoization and dependency tracking
✅ **Optimized Package Imports** - Tree-shaking for Lucide React and UI components
✅ **SWC Minification** - Faster build times with SWC instead of Terser
✅ **Production Source Maps Disabled** - Reduces bundle size in production
✅ **On-Demand Entries** - Optimizes dev server memory usage with configurable buffering

```typescript
experimental: {
  reactCompiler: true,
  optimizePackageImports: ["lucide-react", "@/components/ui"],
}
```

### 2. **Component-Level Memoization**

#### Memoized Components

- **`CollegeCard`** - Prevents re-renders when college data hasn't changed
- **`HeatGrid`** - Optimized cell rendering with memoized computation
- **`ThemeProvider`** - Prevents unnecessary provider re-renders
- **`SiteHeader` & `SiteFooter`** - Layout components wrapped with memo

**Pattern Used:**
```tsx
export const CollegeCard = memo(CollegeCardBase, (prev, next) => {
  // Custom comparison for intelligent re-render detection
  return prev.college.slug === next.college.slug && prev.rank === next.rank;
});
```

### 3. **Performance Utilities** (`src/lib/performance.ts`)

Provides React hooks for optimization patterns:

- **`useDebounce`** - Delays callback execution (search, resize handlers)
- **`useThrottle`** - Limits callback frequency (scroll events)
- **`useMemoized`** - Memoizes expensive computations
- **`useStableCallback`** - Prevents prop changes in memoized children
- **`useIntersectionObserver`** - Lazy-load visibility detection
- **`useLazyComponent`** - Defer rendering heavy components until visible
- **`useBatchedMeasure`** - Batch DOM reads/writes to prevent layout thrashing
- **`arePropsEqual`** - Custom prop comparison for memo
- **`useShallowEqual`** - Value stability for shallow comparisons

### 4. **Font Optimization** (`src/app/layout.tsx`)

```typescript
const geistSans = Geist({
  display: "swap", // Font display optimization
});
```

- **Font Display Strategy**: `swap` - Shows system font until custom font loads
- **Subsets**: Limited to Latin for faster loading
- **Preconnect & DNS Prefetch**: Optimizes Google Fonts CDN connection

### 5. **Network Optimization** (`src/app/layout.tsx`)

```html
<!-- Preconnect to critical external resources -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

<!-- DNS prefetch for APIs -->
<link rel="dns-prefetch" href="https://api.clerk.com" />

<!-- Prefetch common routes for faster navigation -->
<link rel="prefetch" href="/colleges" />
<link rel="prefetch" href="/branches" />
```

### 6. **Viewport & Metadata Optimization** (`src/app/layout.tsx`)

```typescript
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  colorScheme: "light dark",
};
```

- Proper viewport configuration for mobile performance
- Color scheme support prevents layout shift on theme switch
- Metadata optimizations for SEO and browser rendering

### 7. **CSS Optimization** (`src/app/globals.css`)

- **OKLch Color Space** - Modern, perceptually uniform colors (better math than RGB)
- **CSS Variables** - Enables efficient theme switching without re-rendering
- **Minimal Animation Keyframes** - Optimized blob and float animations
- **Tailwind 4** - Latest tree-shaking and utility optimization

### 8. **Code Splitting & Dynamic Imports**

Identify heavy components and import dynamically:

```typescript
const HeavyChart = dynamic(() => import("@/components/HeavyChart"), {
  loading: () => <div>Loading...</div>,
  ssr: false, // Defer to client if not needed on server
});
```

Recommended candidates:
- `BranchGlobalHeatmap` - Large chart rendering
- `AiInsights` - AI-powered features
- `JobMarketPanel` - Market data visualizations
- `PredictorResults` - Complex calculations

## Best Practices for Future Development

### ✅ DO

1. **Use `memo()` for:**
   - Pure components (same props = same output)
   - Components rendered in lists
   - Components with expensive rendering logic

2. **Use `useCallback()` for:**
   - Event handlers passed to memoized children
   - Callback dependencies in effect hooks

3. **Use `useMemo()` for:**
   - Expensive computations
   - Object/array creation in props
   - Selector functions from state

4. **Lazy load with Intersection Observer when:**
   - Component is below the fold
   - Rendering is expensive and visibility-dependent
   - Supporting slower devices/networks

5. **Optimize CSS:**
   - Use Tailwind utilities instead of custom CSS
   - Leverage CSS variables for theming
   - Avoid unnecessary shadows, blurs, and transforms

### ❌ DON'T

1. Don't memoize components that:
   - Always receive different props
   - Have no expensive render logic
   - Receive inline functions/objects as props (unless wrapped in useCallback/useMemo)

2. Don't use `useMemo()` for:
   - Simple values (premature optimization)
   - Small computations (<1ms)
   - Props that frequently change

3. Don't create new objects/arrays in props:
   ```tsx
   // ❌ Bad - new object every render
   <Component style={{ color: "red" }} />
   
   // ✅ Good - constant or memoized
   const style = useMemo(() => ({ color: "red" }), []);
   <Component style={style} />
   ```

4. Don't lazy-load critical content:
   - Above-the-fold content
   - Essential navigation
   - SEO-critical pages

## Monitoring Performance

### Build Metrics

```bash
npm run build  # Check bundle size output
```

### Runtime Performance (Browser DevTools)

1. **Performance Tab**
   - Record interactions
   - Identify long tasks
   - Check frame rate (target: 60 FPS)

2. **React Profiler** (Chrome DevTools)
   - Record component renders
   - Identify unnecessary re-renders
   - Check render duration

3. **Lighthouse**
   - Run audit for comprehensive metrics
   - Core Web Vitals: LCP, FID, CLS

### Key Metrics to Track

- **Largest Contentful Paint (LCP)** - < 2.5s
- **First Input Delay (FID)** - < 100ms
- **Cumulative Layout Shift (CLS)** - < 0.1
- **Time to Interactive (TTI)** - < 3.8s
- **First Paint (FP)** - < 1.8s

## Implementation Checklist

- [x] React Compiler enabled
- [x] Heavy components memoized (CollegeCard, HeatGrid)
- [x] Performance hooks utility module created
- [x] Theme Provider optimized
- [x] Font loading optimized
- [x] Network prefetching added
- [x] Viewport meta tags optimized
- [x] CSS variables for theming
- [ ] Dynamic imports for heavy components (TODO)
- [ ] Route prefetching strategy (TODO)
- [ ] Image optimization (TODO - if adding images)
- [ ] API response caching (TODO)

## Resources

- [Next.js Performance Optimization](https://nextjs.org/docs/app/building-your-application/optimizing)
- [React Compiler](https://react.dev/learn/react-compiler)
- [Web Vitals Guide](https://web.dev/vitals/)
- [MDN Performance Best Practices](https://developer.mozilla.org/en-US/docs/Web/Performance)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

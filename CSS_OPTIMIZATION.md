/**
 * CSS Performance Tips & Advanced Optimization
 * 
 * This file documents CSS optimization techniques used throughout the app.
 */

/* ============================================
   1. CRITICAL: Reduce CLS (Cumulative Layout Shift)
   ============================================ */

/* Reserve space for dynamic content */
.container-with-spinner {
  min-height: 3rem;
  display: flex;
  align-items: center;
}

/* Use aspect-ratio to prevent layout shift on images */
.image-container {
  aspect-ratio: 16 / 9;
  overflow: hidden;
}

/* Lock dialog/modal sizes to prevent resizing */
.modal-dialog {
  width: 90vw;
  max-width: 600px;
  max-height: 90vh;
}

/* ============================================
   2. PERFORMANCE: Transform over Layout Properties
   ============================================ */

/* ✅ GOOD - GPU accelerated, composited layer */
.card-hover:hover {
  transform: translateY(-4px);
  transition: transform 200ms cubic-bezier(0.4, 0, 0.2, 1);
}

/* ❌ AVOID - Triggers layout recalculation */
.card-hover-bad:hover {
  top: -4px; /* Triggers relayout! */
  transition: top 200ms;
}

/* ============================================
   3. PERFORMANCE: Will-change (Use Sparingly!)
   ============================================ */

/* Only for animations that will definitely run */
.animated-element {
  will-change: transform;
  animation: float-y 6s ease-in-out infinite;
}

/* Remove will-change after animation */
.animated-element:animation-end {
  will-change: auto;
}

/* ============================================
   4. RENDERING: CSS Containment
   ============================================ */

/* Isolate component rendering - browser won't recalculate parent layout */
.grid-item {
  contain: layout style paint;
  /* Tells browser: this element's internals don't affect outside layout */
}

/* Use content-visibility for off-screen content (huge performance win!) */
.off-screen-list-item {
  content-visibility: auto;
  contain-intrinsic-size: 0 40px;
  /* Browser skips rendering until visible */
}

/* ============================================
   5. ANIMATION: Prefer Opacity & Transform
   ============================================ */

/* ✅ GOOD - Only 2 properties, GPU accelerated */
.fade-in {
  animation: fadeIn 300ms ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* ✅ GOOD - 1 property, GPU accelerated */
.slide-in {
  animation: slideIn 300ms ease-out forwards;
}

@keyframes slideIn {
  from {
    transform: translateX(-20px);
  }
  to {
    transform: translateX(0);
  }
}

/* ❌ AVOID - Triggers paint & layout */
.bad-animation {
  animation: badAnimation 300ms;
}

@keyframes badAnimation {
  from {
    width: 0;
    height: 0;
    box-shadow: 0 0 0 rgba(0, 0, 0, 0);
  }
  to {
    width: 100%;
    height: 100%;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  }
}

/* ============================================
   6. LAYOUT: Flexbox vs Grid Considerations
   ============================================ */

/* Flexbox: Better for 1D layouts, simpler alignment */
.nav-bar {
  display: flex;
  gap: 1rem;
  align-items: center;
}

/* Grid: Better for 2D, responsive layouts, complex alignment */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

/* ============================================
   7. RESPONSIVE: Mobile-First & Container Queries
   ============================================ */

/* Mobile first - simpler base styles */
.card {
  padding: 1rem;
  font-size: 0.875rem;
}

/* Progressively enhance for larger screens */
@media (min-width: 640px) {
  .card {
    padding: 1.5rem;
    font-size: 1rem;
  }
}

/* Container query: responsive without media query! */
@container (min-width: 400px) {
  .card-title {
    font-size: 1.5rem;
  }
}

/* ============================================
   8. COLORS: Efficient Theme Switching
   ============================================ */

/* ✅ CSS Variables enable instant theme switch without JavaScript */
:root {
  --color-primary: oklch(0.55 0.22 264);
  --color-surface: oklch(1 0 0);
  color-scheme: light;
}

.dark {
  --color-primary: oklch(0.62 0.19 264);
  --color-surface: oklch(0.205 0 0);
  color-scheme: dark;
}

.themed-element {
  background: var(--color-surface);
  color: var(--color-primary);
  /* Theme changes instantly without component re-render! */
}

/* ============================================
   9. TEXT: Font Optimization
   ============================================ */

/* Prevent layout shift during font loading */
body {
  font-family: system-ui, -apple-system, sans-serif;
  /* Fallback to system font until custom font loads */
}

/* Swap in custom font when loaded */
@font-face {
  font-family: "GeistSans";
  font-display: swap; /* Show fallback immediately, swap when ready */
  src: url("/fonts/geist-sans.woff2") format("woff2");
}

/* ============================================
   10. IMAGES & MEDIA: Modern Formats & Lazy Loading
   ============================================ */

/* Use modern image format with fallback */
.responsive-image {
  /* Browser picks first supported format */
}

/* Lazy loading hint for browser */
img[loading="lazy"] {
  /* Browser defers loading until near viewport */
}

/* ============================================
   11. SHADOWS & EFFECTS: Performance Impact
   ============================================ */

/* ✅ Box shadow: Generally performant */
.subtle-shadow {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

/* ✅ Text shadow: Performant for small amounts */
.text-shadow {
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

/* ⚠️ Filter effects: Expensive, use sparingly */
.blur-effect {
  filter: blur(10px);
  /* Creates a new stacking context, triggers composition */
}

/* ⚠️ Drop shadow: More expensive than box-shadow */
.drop-shadow {
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.1));
}

/* ============================================
   12. SCROLL & PAINT: High-Frequency Events
   ============================================ */

/* Debounce scroll events with intersection observer in JS instead of CSS */
.scroll-listener {
  /* Use JavaScript with requestAnimationFrame for scroll-triggered logic */
}

/* Sticky positioning: Efficient for headers */
header {
  position: sticky;
  top: 0;
  z-index: 40;
  /* Much cheaper than fixed positioning */
}

/* ============================================
   13. BLEND MODES & COMPLEX EFFECTS: Use Carefully
   ============================================ */

/* Blend modes trigger compositing - can impact performance */
.blend-darken {
  mix-blend-mode: darken;
  /* OK for static elements, avoid on high-frequency animated elements */
}

/* ============================================
   14. OPTIMIZATION STRATEGIES
   ============================================ */

/* Strategy 1: Use CSS Grid for layout stability */
.layout-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  min-height: 100vh;
  /* Layout shifts prevented by grid structure */
}

/* Strategy 2: Use CSS Container Queries instead of JS */
.responsive-container {
  container-type: inline-size;
}

@container (min-width: 600px) {
  .responsive-child {
    width: 50%;
  }
}

/* Strategy 3: Efficient State Styling */
.toggle-state {
  /* Base state */
}

.toggle-state.is-active {
  /* Only override changed properties */
  background-color: var(--color-primary);
}

/* ============================================
   Summary: CSS Performance Checklist
   ============================================

   DO:
   ✅ Use CSS variables for theming
   ✅ Prefer transform/opacity animations
   ✅ Use flexbox/grid for complex layouts
   ✅ Apply CSS containment for isolated components
   ✅ Use font-display: swap
   ✅ Implement content-visibility for off-screen items
   ✅ Reserve space to prevent CLS
   ✅ Use will-change sparingly and remove it after use

   DON'T:
   ❌ Animate width/height (use transform: scale instead)
   ❌ Animate top/left/right/bottom (use transform instead)
   ❌ Animate box-shadow on fast elements
   ❌ Use filter effects excessively
   ❌ Use multiple text-shadows
   ❌ Avoid position: fixed on performance-critical paths
   ❌ Don't mix layout triggers (top + transform on same element)

*  ============================================
*/

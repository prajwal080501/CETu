/**
 * Performance optimization utilities for React components.
 * Provides helpers for memoization, callback optimization, and debouncing.
 */

import { useMemo, useCallback, useRef, useEffect, useState, DependencyList } from "react";

/**
 * Debounce a callback with a specified delay.
 * Useful for search, resize, scroll handlers to avoid excessive re-renders.
 */
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 300
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  );
}

/**
 * Throttle a callback with a specified interval.
 * Useful for scroll, resize events that fire frequently.
 */
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  interval: number = 300
): (...args: Parameters<T>) => void {
  const lastRunRef = useRef<number>(0);

  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastRunRef.current >= interval) {
        lastRunRef.current = now;
        callback(...args);
      }
    },
    [callback, interval]
  );
}

/**
 * Memoize expensive object or array creation.
 * Use when creating props objects or arrays that would cause
 * child component re-renders unnecessarily.
 */
export function useMemoized<T>(
  factory: () => T,
  deps: DependencyList
): T {
  return useMemo(factory, deps);
}

/**
 * Create a stable callback reference that won't cause child re-renders.
 * Especially useful with React.memo'd components.
 */
export function useStableCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: DependencyList
): T {
  return useCallback(callback, deps) as T;
}

/**
 * Force component optimization by preventing re-renders when props haven't changed.
 * Used with React.memo for granular control over re-render decisions.
 */
export function arePropsEqual<T extends Record<string, any>>(
  prevProps: T,
  nextProps: T,
  ignoredKeys: (keyof T)[] = []
): boolean {
  const ignoreSet = new Set(ignoredKeys);
  const allKeys = new Set([...Object.keys(prevProps), ...Object.keys(nextProps)]);

  for (const key of allKeys) {
    if (ignoreSet.has(key as keyof T)) continue;

    if (prevProps[key as keyof T] !== nextProps[key as keyof T]) {
      return false;
    }
  }

  return true;
}

/**
 * Lightweight selector hook for memoizing derived state.
 * Prevents object recreation on every render.
 */
export function useShallowEqual<T>(value: T): T {
  const ref = useRef(value);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return useMemo(() => ref.current, []);
}

/**
 * Batch DOM reads and writes to prevent layout thrashing.
 * Schedules callback to run after current render batch completes.
 */
export function useBatchedMeasure(
  callback: () => void,
  deps: DependencyList
): void {
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      callback();
    });

    return () => cancelAnimationFrame(id);
  }, deps);
}

/**
 * Intersection Observer hook for lazy-loading and visibility detection.
 * Great for loading images, analytics events, or rendering heavy components.
 */
export function useIntersectionObserver(
  ref: React.RefObject<HTMLElement>,
  options?: IntersectionObserverInit
): boolean {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(element);
        }
      },
      { threshold: 0.01, ...options }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [ref, options]);

  return isVisible;
}

/**
 * Lazy-load component only when visible in viewport.
 * Wrap heavy components to defer rendering until needed.
 */
export function useLazyComponent(
  ref: React.RefObject<HTMLElement>
): boolean {
  return useIntersectionObserver(ref, { threshold: 0 });
}

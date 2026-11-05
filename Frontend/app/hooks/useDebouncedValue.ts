"use client";

import { useEffect, useState } from "react";

/**
 * Give back `value`, but only after it has stopped changing for `delayMs`.
 *
 * Example: you type "D", "Dj", "Dja"... quickly. The debounced value stays
 * "" until you pause, then becomes "Django" in one step.
 * This is called "debouncing".
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    // Start a timer for the newest value...
    const timer = window.setTimeout(() => setDebouncedValue(value), delayMs);
    // ...and cancel it if the value changes again before it fires.
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debouncedValue;
}

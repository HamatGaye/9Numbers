import { useEffect, useState } from 'react';

/**
 * The current time, as state.
 *
 * Reading `Date.now()` directly in a component body is impure and the React
 * Compiler rejects it: a re-render for an unrelated reason would silently change
 * the value. Holding it in state means the countdown is a pure function of
 * render input, and it ticks itself so a phone left open overnight does not keep
 * showing yesterday's day count.
 */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}

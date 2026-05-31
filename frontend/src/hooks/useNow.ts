import { useEffect, useState } from "react";

/**
 * The current epoch time, refreshed every `intervalMs`. Used to drive live
 * "elapsed time" displays so they tick without an external data change.
 */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}

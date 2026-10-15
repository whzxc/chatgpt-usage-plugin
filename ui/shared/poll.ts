import { useEffect, useRef } from "react";

// One timer, no background requests, and no overlap with a slow response.
export function usePoll(
  load: () => Promise<unknown>,
  delay: number,
  active = true,
) {
  const current = useRef(load);
  current.current = load;
  useEffect(() => {
    if (!active) return;
    let timer = 0,
      stopped = false;
    const schedule = () => {
      clearTimeout(timer);
      if (!stopped && document.visibilityState === "visible")
        timer = window.setTimeout(async () => {
          try {
            await current.current();
          } finally {
            schedule();
          }
        }, delay);
    };
    document.addEventListener("visibilitychange", schedule);
    schedule();
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", schedule);
    };
  }, [delay, active]);
}

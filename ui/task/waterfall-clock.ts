import { useEffect, useRef } from "react";
import { duration } from "../shared/format";

// DOM-only clock: no React updates, and offscreen chunks retain content-visibility.
export function useWaterfallClock(
  origin: number | null,
  end: number,
  running: boolean,
) {
  const root = useRef<HTMLDivElement>(null),
    axis = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = root.current!,
      ruler = axis.current!;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0,
      timer = 0,
      visible = true,
      previous = 0,
      tickStep = 0;
    let maximum = Math.max(1000, end);
    const draw = () => {
      const now = origin === null ? 0 : Math.max(0, Date.now() - origin);
      maximum = Math.max(maximum, end, running ? now * 1.12 : 0, 1000);
      element.style.setProperty("--wf-unit", String(100 / maximum));
      element.style.setProperty("--wf-now", String(now));
      const power = 10 ** Math.floor(Math.log10(maximum / 4));
      const step = Math.max(1000, Math.ceil(maximum / 4 / power) * power);
      if (step !== tickStep) {
        tickStep = step;
        ruler.replaceChildren(
          ...Array.from({ length: 5 }, (_, i) => {
            const tick = document.createElement("span");
            tick.textContent = duration(i * step);
            tick.style.setProperty("--tick", String(i * step));
            return tick;
          }),
        );
      }
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
    const animate = (at: number) => {
      if (at - previous >= 32) {
        draw();
        previous = at;
      }
      frame = requestAnimationFrame(animate);
    };
    const coarse = () => {
      draw();
      timer = window.setTimeout(coarse, 1000);
    };
    const resume = () => {
      stop();
      if (document.hidden || !visible) return;
      draw();
      if (running && origin !== null) {
        if (reduced.matches) timer = window.setTimeout(coarse, 1000);
        else frame = requestAnimationFrame(animate);
      }
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      resume();
    });
    observer.observe(element);
    document.addEventListener("visibilitychange", resume);
    reduced.addEventListener("change", resume);
    resume();
    return () => {
      stop();
      observer.disconnect();
      document.removeEventListener("visibilitychange", resume);
      reduced.removeEventListener("change", resume);
    };
  }, [origin, end, running]);
  return { root, axis };
}

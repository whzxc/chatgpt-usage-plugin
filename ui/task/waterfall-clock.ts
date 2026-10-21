import { useEffect, useRef } from "react";
import {
  axisTime,
  barLabelLeft,
  interpolateRange,
  rangeTicks,
  viewportRange,
} from "./waterfall-range";
import type { TimeRange, ViewportSpan } from "./waterfall-range";

// Observe rows once per loaded/collapsed block, never measure the tree per frame.
export function useWaterfallClock(
  origin: number | null,
  end: number,
  running: boolean,
  rows: ViewportSpan[],
  complete: boolean,
) {
  const root = useRef<HTMLDivElement>(null),
    axis = useRef<HTMLDivElement>(null),
    header = useRef<HTMLDivElement>(null),
    grid = useRef<HTMLDivElement>(null);
  const current = useRef<TimeRange | null>(null);
  useEffect(() => {
    const element = root.current!,
      ruler = axis.current!,
      head = header.current!;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const byId = new Map(rows.map((row) => [row.id, row]));
    const visible = new Set<string>();
    const labels = new Map<
      string,
      {
        chart: HTMLElement;
        label: HTMLElement;
        width: number;
        labelWidth: number;
        start: number;
        elapsed: number;
        running: boolean;
      }
    >();
    let frame = 0,
      timer = 0,
      previous = 0,
      ticksKey = "";
    let transition: { from: TimeRange; to: TimeRange; at: number } | null =
      null;
    let observer: IntersectionObserver;
    const now = () => (origin === null ? 0 : Math.max(0, Date.now() - origin));
    const total = () => Math.max(1000, end, running ? now() : 0);
    const selected = () =>
      [...visible].flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
    const desired = () =>
      viewportRange(
        selected(),
        total(),
        now(),
        complete && visible.size === rows.length,
      );
    const write = (range: TimeRange) => {
      // Batch first-visible measurements before any style writes. Offscreen
      // rows never participate in animation or layout measurement.
      for (const id of visible) {
        const entry = labels.get(id);
        if (entry && !entry.width) {
          entry.width = entry.chart.clientWidth;
          entry.labelWidth = entry.label.offsetWidth;
        }
      }
      current.current = range;
      element.style.setProperty("--wf-start", String(range.start));
      element.style.setProperty(
        "--wf-unit",
        String(100 / (range.end - range.start)),
      );
      element.style.setProperty("--wf-now", String(now()));
      element.style.setProperty(
        "--wf-map-start",
        `${(100 * range.start) / total()}%`,
      );
      element.style.setProperty(
        "--wf-map-width",
        `${(100 * (range.end - range.start)) / total()}%`,
      );
      const ticks = rangeTicks(range),
        key = ticks.join();
      for (const id of visible) {
        const entry = labels.get(id);
        if (!entry) continue;
        if (!entry.labelWidth) continue; // Stacked layout has its own label.
        entry.chart.style.setProperty(
          "--wf-label-left",
          `${barLabelLeft(entry.start, entry.running ? now() - entry.start : entry.elapsed, range, entry.width, entry.labelWidth)}px`,
        );
      }
      if (key !== ticksKey) {
        ticksKey = key;
        grid.current!.replaceChildren(
          ...ticks.map((at) => {
            const line = document.createElement("i");
            line.style.setProperty("--tick", String(at));
            return line;
          }),
        );
        ruler.replaceChildren(
          ...ticks.map((at) => {
            const tick = document.createElement("span");
            tick.textContent = axisTime(at);
            tick.style.setProperty("--tick", String(at));
            return tick;
          }),
        );
      }
    };
    const needsClock = () =>
      running &&
      origin !== null &&
      (selected().some((row) => row.running) ||
        (current.current !== null &&
          now() >= current.current.start &&
          now() <= current.current.end + 1000));
    const stop = () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
    const draw = (at: number) => {
      const target = desired();
      if (!target) return;
      if (transition && !reduced.matches) {
        const progress = Math.min(1, (at - transition.at) / 150);
        write(interpolateRange(transition.from, transition.to, progress));
        if (progress === 1) transition = null;
      } else write(target);
    };
    const tick = (at: number) => {
      if (document.hidden || !visible.size) return;
      if (at - previous >= 32 || reduced.matches) {
        draw(at);
        previous = at;
      }
      if (transition || needsClock()) {
        if (reduced.matches)
          timer = window.setTimeout(() => tick(performance.now()), 1000);
        else frame = requestAnimationFrame(tick);
      }
    };
    const update = () => {
      stop();
      if (document.hidden || !visible.size) return;
      const target = desired();
      if (!target) return;
      transition =
        current.current && !reduced.matches
          ? { from: current.current, to: target, at: performance.now() }
          : null;
      if (!transition) write(target);
      previous = 0;
      frame = requestAnimationFrame(tick);
    };
    // A scroll container, when present, also owns the sticky header.
    let scrollRoot: HTMLElement | null = element.parentElement;
    while (
      scrollRoot &&
      !/(auto|scroll)/.test(getComputedStyle(scrollRoot).overflowY)
    )
      scrollRoot = scrollRoot.parentElement;
    if (
      scrollRoot === document.scrollingElement ||
      scrollRoot === document.body
    )
      scrollRoot = null;
    const observe = () => {
      element.style.setProperty(
        "--wf-head-height",
        `${head.offsetHeight + 8}px`,
      );
      observer?.disconnect();
      visible.clear();
      labels.clear();
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const id = (entry.target as HTMLElement).dataset.wfId!;
            if (entry.isIntersecting) visible.add(id);
            else visible.delete(id);
          }
          update();
        },
        { root: scrollRoot, rootMargin: `-${head.offsetHeight}px 0px 0px 0px` },
      );
      element.querySelectorAll<HTMLElement>("[data-wf-id]").forEach((node) => {
        const chart = node.querySelector<HTMLElement>(".wf-chart[data-start]");
        const label = chart?.querySelector<HTMLElement>(".wf-values");
        if (chart && label)
          labels.set(node.dataset.wfId!, {
            chart,
            label,
            width: 0,
            labelWidth: 0,
            start: Number(chart.dataset.start),
            elapsed: Number(chart.dataset.elapsed),
            running: !!chart.dataset.running,
          });
        observer.observe(node);
      });
    };
    const resize = new ResizeObserver(observe);
    resize.observe(head);
    observe();
    document.addEventListener("visibilitychange", update);
    reduced.addEventListener("change", update);
    return () => {
      stop();
      observer.disconnect();
      resize.disconnect();
      document.removeEventListener("visibilitychange", update);
      reduced.removeEventListener("change", update);
    };
  }, [origin, end, running, rows, complete]);
  return { root, axis, header, grid };
}

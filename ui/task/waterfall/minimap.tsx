import { useState } from "react";
import type { CSSProperties } from "react";
import { Button } from "../../components/ui/controls";
import { duration } from "../../shared/format";
import type { Turn } from "../../shared/types";
import { axisTime } from "../waterfall-range";

export type JumpTarget = { id: string; requests: number };

export function Minimap({
  overview,
  busy,
  navigate,
  slowestDuration = null,
  range,
}: {
  range?: [number, number];
  slowestDuration?: number | null;
  overview: NonNullable<Turn["overview"]>;
  busy: boolean;
  navigate: (target: JumpTarget) => void;
}) {
  const [position, setPosition] = useState(0);
  const peak = Math.max(
    1,
    ...overview.buckets.map((bucket) => bucket.requests + bucket.tools),
  );
  const go = (index: number) => {
    const next = Math.max(0, Math.min(overview.buckets.length - 1, index));
    setPosition((next * overview.durationMs) / overview.buckets.length);
    const target = overview.buckets[next].target;
    if (target) navigate(target);
  };
  return (
    <div className="wf-map-wrap">
      <div className="wf-map-head">
        <span>{`整轮调用密度 · ${duration(overview.durationMs)}`}</span>
        {overview.slowest && (
          <Button
            data-adg-id="waterfall-slowest"
            label={`最慢 ${duration(slowestDuration)}`}
            disabled={busy}
            onClick={() => {
              setPosition(overview.slowest!.at);
              navigate(overview.slowest!.target);
            }}
          />
        )}
      </div>
      <div
        className="wf-map"
        style={
          range
            ? ({
                "--wf-map-start": `${(range[0] / overview.durationMs) * 100}%`,
                "--wf-map-width": `${((range[1] - range[0]) / overview.durationMs) * 100}%`,
              } as CSSProperties)
            : undefined
        }
        role="slider"
        tabIndex={busy ? -1 : 0}
        aria-label="整轮调用密度，左右键定位，回车跳转"
        aria-disabled={busy}
        aria-valuemin={0}
        aria-valuemax={overview.durationMs}
        aria-valuenow={position}
        aria-valuetext={axisTime(position)}
        title="每格为调用次数；起点未知时按记录时间定位。点击跳转，框内为当前可见时间范围"
        onClick={(event) => {
          if (!busy) {
            const rect = event.currentTarget.getBoundingClientRect();
            const fraction = (event.clientX - rect.left) / rect.width;
            if (
              overview.slowest &&
              Math.abs(fraction - overview.slowest.at / overview.durationMs) *
                rect.width <=
                4
            ) {
              setPosition(overview.slowest.at);
              navigate(overview.slowest.target);
            } else go(Math.floor(fraction * overview.buckets.length));
          }
        }}
        onKeyDown={(event) => {
          if (busy) return;
          let next = position;
          if (event.key === "ArrowRight")
            next += overview.durationMs / overview.buckets.length;
          else if (event.key === "ArrowLeft")
            next -= overview.durationMs / overview.buckets.length;
          else if (event.key === "Home") next = 0;
          else if (event.key === "End") next = overview.durationMs;
          else if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            go(
              Math.floor(
                (position / overview.durationMs) * overview.buckets.length,
              ),
            );
            return;
          } else return;
          setPosition(Math.max(0, Math.min(overview.durationMs, next)));
          event.preventDefault();
        }}
      >
        <div className="wf-density" aria-hidden="true">
          {overview.buckets.map((bucket, i) => (
            <span key={i}>
              <i style={{ height: `${(bucket.tools * 100) / peak}%` }} />
              <b style={{ height: `${(bucket.requests * 100) / peak}%` }} />
            </span>
          ))}
        </div>
        <i
          data-adg-id="waterfall-range-window"
          className="wf-map-window"
          aria-hidden="true"
        />
        <i
          className="wf-map-cursor"
          aria-hidden="true"
          style={{ left: `${(position * 100) / overview.durationMs}%` }}
        />
        {overview.slowest && (
          <i
            className="wf-map-slowest"
            aria-hidden="true"
            style={{
              left: `${(overview.slowest.at * 100) / overview.durationMs}%`,
            }}
          />
        )}
      </div>
      <div className="wf-map-foot">
        <span>模型 / 工具调用次数</span>
        <span className="wf-visible-range">
          {`可见 ${duration(range?.[0] ?? 0)}–${duration(range?.[1] ?? overview.durationMs)}`}
        </span>
      </div>
    </div>
  );
}

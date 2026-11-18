import { useState } from "react";
import { SingleChoice } from "../components/ui/SingleChoice";
import { Section, Tooltip } from "../components/ui/controls";
import {
  axisCompact,
  compact,
  integer,
  money,
  percent,
} from "../shared/format";
import type { Range, Summary } from "../shared/types";

const modelColor = (slot: number) =>
  slot === 1
    ? "var(--model-primary)"
    : slot === 2
      ? "var(--model-secondary)"
      : "var(--model-other)";

export function ModelLegend({
  summary,
  metric = "tokens",
}: {
  summary: Summary;
  metric?: "tokens" | "cost";
}) {
  const total = summary.models.reduce((sum, m) => sum + (m[metric] ?? 0), 0);
  return (
    <div className="legend">
      {summary.models.map((m) => (
        <div className="legend-item" key={m.id}>
          <div className="legend-head">
            <i className="swatch" style={{ background: modelColor(m.slot) }} />
            <span className="name">{m.id}</span>
            <strong>
              {metric === "tokens" ? compact(m.tokens) : money(m.cost)}
            </strong>
          </div>
          <span className="meta">
            {`${percent(total && m[metric] !== null ? (100 * m[metric]!) / total : null)} · ${money(m.cost)} · ${integer(m.requests)} req · ${m.outputTps === null ? "—" : m.outputTps.toFixed(1)} tok/s`}
          </span>
        </div>
      ))}
    </div>
  );
}

export function UsageChart({
  summary,
  range,
}: {
  summary: Summary;
  range: Range;
}) {
  const [metric, setMetric] = useState<"tokens" | "cost">("tokens"),
    [active, setActive] = useState<number | null>(null);
  const models = [...summary.models].sort((a, b) => a.slot - b.slot),
    hourly = range === "today";
  const totals = summary.buckets.map((b) =>
    b.models.reduce((sum, m) => sum + (m[metric] ?? 0), 0),
  );
  const step = metric === "tokens" ? 100000 : 0.5,
    maximum = Math.max(step, Math.ceil(Math.max(...totals, 0) / step) * step);
  const label = (at: number) => {
    const d = new Date(at);
    return hourly
      ? String(d.getHours()).padStart(2, "0")
      : `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  };
  const format = metric === "tokens" ? compact : money;
  return (
    <Section
      title={hourly ? "今天每小时用量" : "每日用量"}
      actions={
        <SingleChoice
          label="图表指标"
          value={metric}
          options={[
            ["tokens", "Tokens"],
            ["cost", "费用"],
          ]}
          onChange={setMetric}
        />
      }
    >
      <div className="usage-plot">
        <div className="usage-scale">
          {[maximum, maximum / 2, 0].map((v) => (
            <span key={v}>
              {metric === "tokens" ? axisCompact(v) : money(v)}
            </span>
          ))}
        </div>
        <div
          className={`usage-buckets${hourly ? " hourly" : ""}`}
          style={{
            gridTemplateColumns: `repeat(${Math.max(1, summary.buckets.length)},minmax(0,1fr))`,
          }}
        >
          {summary.buckets.map((b, i) => (
            <button
              className="usage-bucket"
              key={b.at}
              aria-label={`${label(b.at)}，${format(totals[i])}`}
              aria-pressed={active === i}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onClick={() => setActive(i)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setActive(null);
                if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                  e.preventDefault();
                  const next = Math.max(
                    0,
                    Math.min(
                      summary.buckets.length - 1,
                      i + (e.key === "ArrowRight" ? 1 : -1),
                    ),
                  );
                  (
                    e.currentTarget.parentElement?.children[next] as HTMLElement
                  )?.focus();
                }
              }}
            >
              <span className="usage-bar">
                {models.map((m) => (
                  <i
                    key={m.id}
                    style={{
                      height: `${((b.models.find((x) => x.id === m.id)?.[metric] ?? 0) / maximum) * 100}%`,
                      background: modelColor(m.slot),
                    }}
                  />
                ))}
              </span>
              <span>{!hourly || i % 4 === 0 ? label(b.at) : " "}</span>
            </button>
          ))}
        </div>
      </div>
      {active !== null && summary.buckets[active] && (
        <div className="inspection">
          <div
            style={{
              position: "absolute",
              width: 240,
              maxWidth: "100%",
              left: `clamp(0px, calc(60px + (100% - 60px) * ${(active + 0.5) / summary.buckets.length} - 120px), max(0px, 100% - 240px))`,
            }}
          >
            <Tooltip
              title={label(summary.buckets[active].at)}
              rows={models.map((m) => ({
                label: m.id,
                value: format(
                  summary.buckets[active].models.find((x) => x.id === m.id)?.[
                    metric
                  ] ?? null,
                ),
              }))}
            />
          </div>
        </div>
      )}
      {models.length > 1 && <ModelLegend summary={summary} metric={metric} />}
    </Section>
  );
}

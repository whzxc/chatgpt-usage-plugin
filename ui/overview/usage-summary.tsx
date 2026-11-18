import { SingleChoice } from "../components/ui/SingleChoice";
import { MetricGrid, Section } from "../components/ui/controls";
import { summaryFigures } from "../shared/metrics";
import { Failure, Indexing } from "../shared/status";
import type { Range, Summary } from "../shared/types";

const ranges: [Range, string][] = [
  ["today", "今天"],
  ["7d", "7 天"],
  ["30d", "30 天"],
];

export function Figures({ summary }: { summary: Summary }) {
  return <MetricGrid items={summaryFigures(summary.totals)} />;
}

export function UsageSummary({
  summary,
  range,
  onRange,
  busy = false,
  retry,
}: {
  summary: Summary;
  range: Range;
  onRange: (v: Range) => void;
  busy?: boolean;
  retry: () => void;
}) {
  const index = summary.index;
  return (
    <Section
      title="本机用量"
      actions={
        index.state === "ready" && (
          <SingleChoice
            value={range}
            label="用量范围"
            options={ranges}
            onChange={onRange}
            disabled={busy}
          />
        )
      }
    >
      {index.state === "indexing" ? (
        <Indexing index={index} />
      ) : index.state === "unavailable" ? (
        <Failure error={index.reason || "无法读取本机用量"} retry={retry} />
      ) : (
        <Figures summary={summary} />
      )}
    </Section>
  );
}

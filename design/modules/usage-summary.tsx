import { Frame } from "sdg";
import { frame } from "../support/frame";
import { copy } from "../fixtures/usage";
import { usageSummaryExamples } from "../fixtures/overview";
import { Section } from "../components/layout";
import { SingleChoice } from "../components/single-choice";
import { MetricGrid } from "../components/metric-figure";
import { Status } from "../components/status";
export function UsageSummary({
  items = [],
  loading = false,
  error = false,
  disabled = false,
  processed,
  total,
}: {
  items?: { label: string; value: string; detail?: string }[];
  loading?: boolean;
  error?: boolean;
  disabled?: boolean;
  processed?: number;
  total?: number;
}) {
  return (
    <Section
      title="本机用量"
      actions={
        !loading &&
        !error && (
          <SingleChoice
            label="用量范围"
            items={copy.ranges}
            value="7 天"
            disabled={disabled}
          />
        )
      }
    >
      {loading ? (
        <Status kind="indexing" processed={processed} total={total} />
      ) : error ? (
        <Status kind="error" />
      ) : (
        <MetricGrid items={items} />
      )}
    </Section>
  );
}
export default () =>
  usageSummaryExamples.map(({ name, props }) => (
    <Frame
      {...frame("usage-summary", name)}
      width={680}
      capture={{ selector: "[data-design-module]", viewport: "720x2400" }}
    >
      <div
        data-design-module
        class="w-full p-1 font-ui text-body leading-normal"
      >
        <UsageSummary {...props} />
      </div>
    </Frame>
  ));

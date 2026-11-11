import {
  quotaForms,
  quotaWindows,
  quotaAccount,
  quotaStatusExamples,
} from "../fixtures/quota";
import { Frame } from "adg";
import { frame } from "../support/frame";
import { percent, number } from "../support/format";

import { Status } from "../components/status";
import { Stack, Grid, Section } from "../components/layout";
export function QuotaBar({
  window,
}: {
  window: (typeof quotaWindows)[number];
}) {
  const remaining = Math.max(0, 100 - window.used),
    cycle = 100 - (window.elapsed / window.duration) * 100,
    over = window.used > (window.elapsed / window.duration) * 100 + 10;
  return (
    <div class="flex flex-col gap-2">
      <div class="flex justify-between text-meta gap-4">
        <span>{window.label}</span>
        <strong
          class={remaining === 0 ? "text-danger" : over ? "text-warning" : ""}
        >
          剩余 {percent(remaining)}
        </strong>
      </div>
      <div
        data-free
        role="meter"
        aria-label={`${window.label}剩余额度`}
        aria-valuenow={remaining}
        aria-valuemin={0}
        aria-valuemax={100}
        class="relative h-2 rounded-control bg-border"
      >
        <span
          class={`block h-full rounded-control ${remaining === 0 ? "bg-danger" : over ? "bg-warning" : "bg-accent"}`}
          style={{ width: `${remaining}%` }}
        />
        <i
          class="absolute top-0 h-2 border-l-2 border-text"
          style={{ left: `${cycle}%` }}
        />
      </div>
      <div class="flex justify-between text-meta text-muted">
        <span>周期剩余 {percent(cycle)}</span>
        <span>{window.reset}</span>
      </div>
      {(remaining === 0 || over) && (
        <span
          class={`text-meta ${remaining === 0 ? "text-danger" : "text-warning"}`}
        >
          {remaining === 0 ? "额度已用完" : "额度消耗快于周期进度"}
        </span>
      )}
    </div>
  );
}
export function QuotaSection({
  windows = quotaWindows,
  credits = false,
  loading = false,
  error,
}: {
  windows?: typeof quotaWindows;
  credits?: boolean;
  loading?: boolean;
  error?: string;
}) {
  if (loading || error)
    return (
      <Section title="账户额度">
        <Status
          kind={error ? "error" : "loading"}
          message={error || "正在读取账户额度"}
        />
      </Section>
    );
  return (
    <Section
      title="账户额度"
      actions={<span class="text-meta text-muted">{quotaAccount.plan}</span>}
    >
      {credits && (
        <p class="text-meta text-muted">
          积分 {number(quotaAccount.credits)} · 可用重置{" "}
          {number(quotaAccount.availableResets)} 次
        </p>
      )}
      <Grid columns={2}>
        {windows.map((window) => (
          <QuotaBar window={window} />
        ))}
      </Grid>
    </Section>
  );
}

export default () => [
  <Frame
    {...frame("quota", "bar-windows")}
    width={680}
    capture={{ selector: "[data-design-module]", viewport: "720x2400" }}
  >
    <div
      data-design-module
      class="w-full p-1 font-ui text-body leading-normal flex flex-col gap-6"
    >
      <Stack>
        {quotaForms.map((window) => (
          <QuotaBar window={window} />
        ))}
      </Stack>
    </div>
  </Frame>,
  <Frame
    {...frame("quota", "section-credits-and-exhaustion")}
    width={680}
    capture={{ selector: "[data-design-module]", viewport: "720x2400" }}
  >
    <div
      data-design-module
      class="w-full p-1 font-ui text-body leading-normal flex flex-col gap-6"
    >
      <QuotaSection windows={quotaForms.slice(2)} credits />
    </div>
  </Frame>,
  ...quotaStatusExamples.map(({ name, props }) => (
    <Frame
      {...frame("quota", name)}
      width={680}
      capture={{ selector: "[data-design-module]", viewport: "720x2400" }}
    >
      <div
        data-design-module
        class="w-full p-1 font-ui text-body leading-normal"
      >
        <QuotaSection {...props} />
      </div>
    </Frame>
  )),
];

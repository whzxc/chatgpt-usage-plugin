import { Section } from "../components/ui/controls";
import { Failure, Status } from "../shared/status";
import {
  calendarTime,
  integer,
  percent,
  productName,
  time,
} from "../shared/format";
import type { Quota } from "../shared/types";

export function QuotaBar({ window: w }: { window: Quota["windows"][number] }) {
  const remaining = Math.max(0, Math.min(100, 100 - w.usedPercent));
  const cycle =
    w.elapsedPercent === null
      ? null
      : 100 - Math.max(0, Math.min(100, w.elapsedPercent));
  const over =
    w.elapsedPercent !== null && w.usedPercent > w.elapsedPercent + 10;
  const name =
    w.durationMinutes === 10080
      ? "每周"
      : w.durationMinutes
        ? `${Math.round(w.durationMinutes / 60)} 小时`
        : w.id;
  const reset =
    w.resetsAt === null
      ? "—"
      : new Date(w.resetsAt).toDateString() === new Date().toDateString()
        ? time(w.resetsAt)
        : calendarTime(w.resetsAt);
  return (
    <div className="quota">
      <div className="quota-line">
        <span>{name}</span>
        <strong
          className={remaining === 0 ? "danger" : over ? "warning" : undefined}
        >
          {`剩余 ${percent(remaining)}`}
        </strong>
      </div>
      <div
        className="meter"
        role="meter"
        aria-label={`${name}剩余额度`}
        aria-valuenow={remaining}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span
          className={`meter-fill ${remaining === 0 ? "critical" : over ? "over" : ""}`}
          style={{ width: `${remaining}%` }}
        />
        {cycle !== null && (
          <i className="meter-now" style={{ left: `${cycle}%` }} />
        )}
      </div>
      <div className="quota-line muted">
        <span>{`周期剩余 ${percent(cycle)}`}</span>
        <span>{`${reset} 重置`}</span>
      </div>
      {(remaining === 0 || over) && (
        <span className={remaining === 0 ? "danger" : "warning"}>
          {remaining === 0 ? "额度已用完" : "额度消耗快于周期进度"}
        </span>
      )}
    </div>
  );
}

export function QuotaBlock({
  quota,
  retry,
}: {
  quota: Quota;
  retry: () => void;
}) {
  return (
    <Section
      title="账户额度"
      actions={
        quota.state === "ready" &&
        quota.plan && <span className="meta">{productName(quota.plan)}</span>
      }
    >
      {quota.state === "loading" ? (
        <Status message="正在读取账户额度" />
      ) : quota.state !== "ready" ? (
        <Failure
          error={`无法读取账户额度：${quota.reason || "账户不可用"}`}
          retry={retry}
        />
      ) : (
        <>
          {(quota.credits !== null || quota.availableResets !== null) && (
            <p className="meta">
              {[
                quota.credits !== null
                  ? `积分 ${integer(quota.credits)}`
                  : null,
                quota.availableResets !== null
                  ? `可用重置 ${integer(quota.availableResets)} 次`
                  : null,
              ]
                .filter((value) => value !== null)
                .join(" · ")}
            </p>
          )}
          <div className="quota-grid">
            {[...quota.windows]
              .sort(
                (a, b) =>
                  (a.durationMinutes ?? Infinity) -
                  (b.durationMinutes ?? Infinity),
              )
              .map((w) => (
                <QuotaBar key={w.id} window={w} />
              ))}
          </div>
        </>
      )}
    </Section>
  );
}

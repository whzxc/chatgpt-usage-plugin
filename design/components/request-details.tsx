import { Frame } from "sdg";
import { frame, compact, money, duration } from "../scenes/format";
import {
  baseTurn,
  copy,
  cost,
  models,
  type Call,
  type Turn,
} from "../scenes/usage";
import { Panel, Grid, Stack } from "./layout";
import { Status } from "./status";
import { Button } from "./button";
export function RequestDetails({
  call = baseTurn.calls[2],
  turn = baseTurn,
  narrative = "collapsed",
}: {
  call?: Call;
  turn?: Turn;
  narrative?: "collapsed" | "full" | "loading" | "error";
}) {
  const facts = [
    { label: "模型", value: call.model },
    { label: "输入", value: compact(call.input) },
    { label: "缓存", value: compact(call.cached) },
    { label: "输出", value: compact(call.output) },
    { label: "推理 tokens", value: compact(call.reasoning) },
    { label: "估算费用", value: money(cost(call)) },
  ];
  const notes = [
    { label: "思考", text: copy.reasoning },
    { label: "回复", text: copy.reply },
  ];
  return (
    <div class="rounded-panel bg-surface p-4 flex flex-col gap-4">
      <div class="flex justify-between items-center gap-4">
        <h3 class="text-body font-semibold">
          请求 #{models(turn.calls).findIndex((c) => c.id === call.id) + 1} ·{" "}
          {call.label}
        </h3>
        <Button label="关闭请求详情" icon="x" />
      </div>
      <p class="text-meta text-muted">{copy.requestWarning}</p>
      <Grid>
        {facts.map((f) => (
          <div class="flex flex-col gap-1 min-w-0">
            <span class="text-meta text-muted">{f.label}</span>
            <span class="text-body break-words">{f.value}</span>
          </div>
        ))}
      </Grid>
      {notes.map((n, i) => {
        const expanded =
          narrative === "full" || (i === 0 && narrative !== "collapsed");
        return (
          <div class="flex flex-col gap-2">
            <button
              aria-expanded={expanded}
              class="flex items-center gap-3 text-left min-w-0"
            >
              <strong class="text-meta shrink-0">{n.label}</strong>
              {!expanded && (
                <span class="text-meta text-muted break-words">{n.text}</span>
              )}
            </button>
            {narrative === "full" && (
              <p class="text-body leading-relaxed">{n.text}</p>
            )}
            {i === 0 && narrative === "loading" && (
              <Status message="正在读取全文" />
            )}
            {i === 0 && narrative === "error" && (
              <Status kind="error" message="无法读取全文" />
            )}
          </div>
        );
      })}
    </div>
  );
}
export default () => [
  <Frame {...frame("request-details", "narrative")}>
    <Panel>
      <RequestDetails narrative="full" />
    </Panel>
  </Frame>,
];

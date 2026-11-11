import { Frame } from "adg";
import { frame } from "../support/frame";
import { compact, money } from "../support/format";
import {
  baseTurn,
  copy,
  cost,
  models,
  type Call,
  type Turn,
} from "../fixtures/usage";
import { Grid } from "../components/layout";
import { Status } from "../components/status";
import { Button } from "../components/button";
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
  <Frame
    {...frame("request-details", "full")}
    width={680}
    capture={{ selector: "[data-design-module]", viewport: "720x2400" }}
  >
    <div
      data-design-module
      class="w-full p-1 font-ui text-body leading-normal flex flex-col gap-6"
    >
      <RequestDetails narrative="full" />
    </div>
  </Frame>,
  <Frame
    {...frame("request-details", "collapsed")}
    width={680}
    capture={{ selector: "[data-design-module]", viewport: "720x2400" }}
  >
    <div
      data-design-module
      class="w-full p-1 font-ui text-body leading-normal flex flex-col gap-6"
    >
      <RequestDetails narrative="collapsed" />
    </div>
  </Frame>,
  <Frame
    {...frame("request-details", "loading")}
    width={680}
    capture={{ selector: "[data-design-module]", viewport: "720x2400" }}
  >
    <div
      data-design-module
      class="w-full p-1 font-ui text-body leading-normal flex flex-col gap-6"
    >
      <RequestDetails narrative="loading" />
    </div>
  </Frame>,
  <Frame
    {...frame("request-details", "error")}
    width={680}
    capture={{ selector: "[data-design-module]", viewport: "720x2400" }}
  >
    <div
      data-design-module
      class="w-full p-1 font-ui text-body leading-normal flex flex-col gap-6"
    >
      <RequestDetails narrative="error" />
    </div>
  </Frame>,
];

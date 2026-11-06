import { Frame } from "sdg";
import { frame, duration } from "../scenes/format";
import {
  baseTurn,
  density,
  slowest,
  elapsed,
  type Turn,
} from "../scenes/usage";
import { Panel } from "./layout";
import { Button } from "./button";
export function Minimap({
  turn = baseTurn,
  range,
  selected,
  busy = false,
}: {
  turn?: Turn;
  range?: [number, number];
  selected?: number;
  busy?: boolean;
}) {
  const data = density(turn),
    peak = Math.max(1, ...data.map((b) => b.models + b.tools)),
    end = turn.end ?? turn.now,
    window = range ?? [0, end],
    slow = slowest(turn);
  return (
    <div class="flex flex-col gap-2">
      <div class="flex justify-between items-center text-meta text-muted">
        <span>整轮调用密度 · {duration(end - turn.start)}</span>
        {slow && (
          <Button label={`最慢 ${duration(elapsed(slow))}`} disabled={busy} />
        )}
      </div>
      <div
        data-free
        role="slider"
        aria-label="整轮调用密度"
        aria-valuenow={selected ?? 0}
        aria-valuemin={0}
        aria-valuemax={end}
        aria-disabled={busy}
        class="relative bg-surface h-10 rounded-control"
      >
        <div class="absolute inset-0 flex items-end gap-1 p-1">
          {data.map((bucket) => (
            <div class="flex-1 h-full flex flex-col-reverse">
              <i
                class="block bg-model-primary"
                style={{ height: `${(bucket.models / peak) * 100}%` }}
              />
              <i
                class="block bg-tool"
                style={{ height: `${(bucket.tools / peak) * 100}%` }}
              />
            </div>
          ))}
        </div>
        <span
          class="absolute top-0 h-full border-2 border-focus rounded-control"
          style={{
            left: `${(window[0] / end) * 100}%`,
            width: `${((window[1] - window[0]) / end) * 100}%`,
          }}
        />
        {slow && (
          <i
            class="absolute top-0 h-full border-l-2 border-tool"
            style={{ left: `${((slow.start ?? slow.at) / end) * 100}%` }}
          />
        )}
        {selected !== undefined && (
          <i
            class="absolute top-0 h-full border-l-2 border-text"
            style={{ left: `${(selected / end) * 100}%` }}
          />
        )}
      </div>
      <div class="flex justify-between text-meta text-muted">
        <span>模型 / 工具调用次数</span>
        <span>
          可见 {duration(window[0])}–{duration(window[1])}
        </span>
      </div>
    </div>
  );
}
export default () => [
  <Frame {...frame("minimap", "selected-range")}>
    <Panel>
      <Minimap range={[7000, 24000]} selected={12000} />
    </Panel>
  </Frame>,
  <Frame {...frame("minimap", "loading-target")}>
    <Panel>
      <Minimap busy />
    </Panel>
  </Frame>,
];

import { copy } from "./usage";
import { waterfallProps } from "./waterfall";
export const turnFrames = ["completed", "request-detail"] as const;
export const turnTitle = copy.task;
export const turnScenes = {
  completed: waterfallProps("completed"),
  "request-detail": waterfallProps("request-detail"),
};

// Settled positions in the 480px review scroller after the real minimap click.
export const waterfallPilot = {
  completed: {
    scroll: 190,
    target: "tool:t2",
    initial: { range: [0, 24960], firstRowTop: 215 },
    jumped: { range: [10680, 45000], firstRowTop: 78 },
  },
  running: {
    scroll: "end",
    target: "request:r1",
    initial: { range: [4400, 20000], firstRowTop: 115 },
    jumped: { range: [0, 20000], firstRowTop: 206 },
  },
} as const;

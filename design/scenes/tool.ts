export const longOutput = Array.from(
  { length: 900 },
  (_, i) =>
    `sample_${String(i + 1).padStart(4, "0")}: temperature = 18.65; status = valid`,
).join("\n");

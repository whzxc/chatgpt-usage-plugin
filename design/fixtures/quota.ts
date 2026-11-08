export const quotaWindows = [
  {
    label: "5 小时",
    duration: 300,
    elapsed: 126,
    used: 32,
    reset: "18:00 重置",
  },
  {
    label: "每周",
    duration: 10080,
    elapsed: 6552,
    used: 58,
    reset: "11/09 09:00 重置",
  },
];
export const quotaForms = [
  ...quotaWindows,
  {
    label: "5 小时",
    duration: 300,
    elapsed: 60,
    used: 88,
    reset: "18:00 重置",
  },
  {
    label: "每周",
    duration: 10080,
    elapsed: 8000,
    used: 100,
    reset: "11/09 09:00 重置",
  },
];

export const quotaAccount = { plan: "Plus", credits: 120, availableResets: 2 };

export const quotaStatusExamples = [
  { name: "section-loading", props: { loading: true } },
  { name: "section-error", props: { error: "无法读取账户额度：账户不可用" } },
];

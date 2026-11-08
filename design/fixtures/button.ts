export const buttonActions: {
  label: string;
  icon?: "refresh-cw" | "x";
  disabled?: boolean;
  busy?: boolean;
  focus?: boolean;
}[] = [
  { label: "重试" },
  { label: "正在更新", busy: true },
  { label: "下一页", disabled: true },
  { label: "刷新", icon: "refresh-cw", focus: true },
  { label: "关闭", icon: "x" },
];

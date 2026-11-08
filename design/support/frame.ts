export function frame(source: string, name: string) {
  return {
    name,
    width: 720,
    fixture: `cup-${source}-${name}`,
    capture: { page: true as const, viewport: "720x2400" },
    note: "Visual baseline approved at 2f983b9. Governance review status: docs/design-assets.md.",
  };
}

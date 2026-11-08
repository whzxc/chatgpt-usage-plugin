import fixtures from "./tooling/design-review/fixtures.json" with { type: "json" };
import { startDesignDev } from "./tooling/design-dev.mjs";
export default {
  requires: ">=0.5.0",
  design: "design",
  output: "output/design",
  compare: {
    port: 5191,
    viewport: "720x2400",
    start: ({ port }) => startDesignDev(port),
    fixture(name) {
      if (!fixtures.includes(name))
        throw new Error(`Unknown design fixture: ${name}`);
      return {
        url: `/__design/review?fixture=${encodeURIComponent(name)}`,
        theme: process.env.CUP_REVIEW_THEME === "dark" ? "dark" : "light",
        locale: "zh-CN",
        timezone: "Asia/Shanghai",
        clock: "2026-11-06T06:32:00Z",
      };
    },
    async ready(page, name) {
      await page.waitForFunction(
        (name) =>
          document.documentElement.dataset.fixtureError ||
          document.documentElement.dataset.fixtureReady === name,
        name,
        { timeout: 15000 },
      );
      const error = await page.evaluate(
        () => document.documentElement.dataset.fixtureError,
      );
      if (error) throw new Error(`Design fixture ${name}: ${error}`);
      if (name.endsWith("-stale")) {
        await page.getByRole("button", { name: "刷新", exact: true }).click();
        await page.locator(".status-stale").waitFor();
      }
      if (
        [
          "cup-usage-trend-chart-selected",
          "cup-usage-trend-chart-hourly-cost",
        ].includes(name)
      ) {
        if (name.endsWith("hourly-cost"))
          await page.getByRole("radio", { name: "费用", exact: true }).click();
        await page
          .locator(".usage-bucket")
          .nth(name.endsWith("hourly-cost") ? 14 : 4)
          .click();
      }
      if (name === "cup-context-chart-selected-compaction")
        await page.locator(".ctx-targets button").nth(8).focus();
      if (["cup-turn-request-detail"].includes(name))
        await page.locator('[data-wf-id="request:r2"]').press("Enter");
      if (
        [
          "cup-request-details-full",
          "cup-request-details-loading",
          "cup-request-details-error",
          "cup-turn-request-detail",
        ].includes(name)
      ) {
        const notes = page.locator(".wf-note > button");
        await notes.nth(0).click();
        if (
          ["cup-request-details-full", "cup-turn-request-detail"].includes(name)
        ) {
          await notes.nth(1).click();
          await page.locator(".wf-full-text p").nth(1).waitFor();
        } else
          await page
            .locator(
              name.endsWith("loading")
                ? ".wf-full-text .status-loading"
                : ".wf-full-text .status-error",
            )
            .waitFor();
      }
      if (
        [
          "cup-tool-dialog-surface-copy-error",
          "cup-tool-dialog-dialog-copy-error",
        ].includes(name)
      ) {
        await page.evaluate(() =>
          Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: {
              writeText: () =>
                Promise.reject(new Error("Fictional clipboard denial")),
            },
          }),
        );
        await page
          .getByRole("button", { name: "复制输出", exact: true })
          .click();
        await page
          .getByText("无法复制。请重新复制。", { exact: true })
          .waitFor();
      }
      if (
        (name.startsWith("cup-tool-dialog-dialog-") ||
          name.startsWith("cup-tool-dialog-surface-")) &&
        !name.endsWith("loading")
      )
        await page
          .locator(
            name.endsWith("error") && !name.endsWith("copy-error")
              ? ".status-error"
              : ".tool-body",
          )
          .first()
          .waitFor();
      if (name === "cup-waterfall-minimap-selected-range") {
        await page
          .getByRole("button", { name: "最慢 12s", exact: true })
          .click();
        await page.getByRole("slider").focus();
      }
      if (["cup-waterfall-waterfall-unknown"].includes(name)) {
        const row = page.locator('[data-wf-id="request:r2"]');
        await row.press("ArrowRight");
        await row.evaluate((element) => element.blur());
      }
      if (["cup-waterfall-waterfall-running"].includes(name)) {
        // The approved review state folds request #1; runtime defaults still
        // expand the slowest branch when the turn first opens.
        const row = page.locator('[data-wf-id="request:r1"]');
        if ((await row.getAttribute("aria-expanded")) === "true")
          await row.press("ArrowLeft");
        await row.evaluate((element) => element.blur());
      }
      if (["cup-turn-summary-summary-error"].includes(name))
        await page.locator(".status-error").waitFor();
      const focus = {
        "cup-button-actions": '[aria-label="刷新"]',
        "cup-search-field": ".search:nth-child(2) input",
        "cup-single-choice-selection": '[role="radio"][aria-checked="true"]',
        "cup-task-list-row-selection-long": ".task-name",
        "cup-task-list-list-selected": ".task-name",
        "cup-turn-summary-header-states": ".turn-head",
        "cup-waterfall-row-branches": '[data-wf-id="tool:t2"]',
        "cup-turn-request-detail": '[data-wf-id="request:r2"]',
      }[name];
      if (focus) {
        await page.keyboard.press("Tab");
        await page.locator(focus).first().focus();
      }
      if (
        name.startsWith("cup-tool-dialog-dialog-") ||
        name.startsWith("cup-tool-dialog-surface-")
      ) {
        await page.keyboard.press("Tab");
        await page.getByRole("button", { name: "关闭", exact: true }).focus();
      }
      if (name.startsWith("cup-tool-dialog-dialog-")) {
        // Match the module specimen's 4px clearance around the existing 720px modal region.
        await page.evaluate(() => {
          const dialog = document.querySelector("dialog");
          dialog.style.top = "44px";
          const region = document.createElement("div");
          region.dataset.designModule = "";
          const height = dialog.getBoundingClientRect().height + 88;
          region.style.cssText = `position:absolute;left:0;top:0;width:728px;height:${height}px;padding:4px;background:var(--canvas)`;
          const overlay = document.createElement("div");
          overlay.style.cssText =
            "width:100%;height:100%;background:var(--overlay)";
          region.append(overlay);
          document.body.append(region);
          dialog.close();
          region.append(dialog);
          dialog.showModal();
          dialog.querySelector('button[aria-label="关闭"]').focus();
          const style = document.createElement("style");
          style.textContent = ".tool-dialog::backdrop{background:transparent}";
          document.head.append(style);
        });
      }
      await page.mouse.move(719, 2399);
    },
    block: ["**/__plugin/**", "**/api/**", "https://**"],
  },
};

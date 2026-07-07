import { expect, test } from "@playwright/test";

test("tabs: right-click a tab to rename the note", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "＋ New note" }).click();
  await expect(page.locator(".ProseMirror")).toBeVisible();
  const path = (await page.locator(".status-path").textContent())?.trim() ?? "";
  const name = path.split("/").pop() ?? "";
  const title = name.replace(/\.[^.]+$/, "");

  const tab = page.locator(".tab", { hasText: title }).first();
  await tab.click({ button: "right" });
  await expect(page.locator(".context-menu")).toBeVisible();

  const renamed = `Tab-Renamed-${Date.now()}`;
  page.once("dialog", (dialog) => dialog.accept(renamed));
  await page.getByRole("menuitem", { name: /Rename/ }).click();

  // The open tab reflects the new name.
  await expect(page.locator(".tab", { hasText: renamed })).toBeVisible();

  // Closing the tab via the context menu leaves no editor pane content.
  await page.locator(".tab", { hasText: renamed }).first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Close", exact: true }).click();
  await expect(page.locator(".tab", { hasText: renamed })).toHaveCount(0);
});

import { expect, test } from "@playwright/test";

test("tabs: right-click a tab to rename the note", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "＋ New note" }).click();
  const rendered = page.locator(".ProseMirror").first();
  await expect(rendered).toBeVisible();
  await rendered.click();
  await page.keyboard.type("keep me");
  const path = (await page.locator(".status-path").textContent())?.trim() ?? "";
  const name = path.split("/").pop() ?? "";
  const title = name.replace(/\.[^.]+$/, "");

  const tab = page.locator(".tab", { hasText: title }).first();
  await tab.click({ button: "right" });
  const tabMenu = page.locator(".tab-bar .context-menu");
  await expect(tabMenu).toBeVisible();

  const renamed = `Tab-Renamed-${Date.now()}`;
  const renamedFile = `${renamed}.md`;
  await tabMenu.getByRole("menuitem", { name: /Rename/ }).click();
  const renameInput = page.locator(".tree-rename-input").first();
  await expect(renameInput).toBeVisible();
  await renameInput.fill(renamed);
  await renameInput.press("Enter");

  // The renamed note appears in the explorer and can be reopened as a tab.
  const renamedRow = page.locator(".tree-file", { hasText: renamedFile }).first();
  await expect(renamedRow).toBeVisible();
  await renamedRow.click();
  await expect(page.locator(".tab", { hasText: renamed }).first()).toBeVisible();

  // Closing the tab via the context menu leaves no editor pane content.
  await page.locator(".tab", { hasText: renamed }).first().click({ button: "right" });
  await page
    .locator(".tab-bar .context-menu")
    .getByRole("menuitem", { name: "Close", exact: true })
    .click();
  await expect(page.locator(".tab", { hasText: renamed })).toHaveCount(0);
});

import { expect, test } from "@playwright/test";

test("explorer: rename a note via the right-click menu", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "＋ New note" }).click();
  await expect(page.locator(".ProseMirror")).toBeVisible();
  const path = (await page.locator(".status-path").textContent())?.trim() ?? "";
  const name = path.split("/").pop() ?? "";
  expect(name).toMatch(/New Note.*\.md/);

  const row = page.locator(".tree-file", { hasText: name }).first();
  await row.click({ button: "right" });
  await expect(page.locator(".context-menu")).toBeVisible();

  const renamed = `Renamed-${Date.now()}.md`;
  page.once("dialog", (dialog) => dialog.accept(renamed));
  await page.getByRole("menuitem", { name: /Rename/ }).click();

  const renamedRow = page.locator(".tree-file", { hasText: renamed });
  await expect(renamedRow).toBeVisible();

  // Delete it via the context menu.
  await renamedRow.click({ button: "right" });
  await expect(page.locator(".context-menu")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expect(page.locator(".tree-file", { hasText: renamed })).toHaveCount(0);
});

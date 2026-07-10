import { expect, test } from "@playwright/test";

test("explorer: rename a note via the right-click menu", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "＋ New note" }).click();
  const rendered = page.locator(".ProseMirror").first();
  await expect(rendered).toBeVisible();
  await rendered.click();
  await page.keyboard.type("keep me");
  const path = (await page.locator(".status-path").textContent())?.trim() ?? "";
  const name = path.split("/").pop() ?? "";
  expect(name).toMatch(/New Note.*\.md/);

  const row = page.locator(".tree-file", { hasText: name }).first();
  await row.click({ button: "right" });
  await expect(page.locator(".context-menu")).toBeVisible();

  const renamedStem = `Renamed-${Date.now()}`;
  const renamed = `${renamedStem}.md`;
  await page.getByRole("menuitem", { name: /Rename/ }).click();
  const renameInput = page.locator(".tree-rename-input").first();
  await expect(renameInput).toBeVisible();
  await renameInput.fill(renamedStem);
  await renameInput.press("Enter");

  const renamedRow = page.locator(".tree-file", { hasText: renamed });
  await expect(renamedRow).toBeVisible();

  // Delete it via the context menu.
  await renamedRow.click({ button: "right" });
  await expect(page.locator(".context-menu")).toBeVisible();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expect(page.locator(".tree-file", { hasText: renamed })).toHaveCount(0);
});

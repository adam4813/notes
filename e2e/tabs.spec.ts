import { expect, test } from "@playwright/test";
import { createNamedNote } from "./test-helpers";

test("tabs: right-click a tab to rename the note", async ({ page }) => {
  await page.goto("/");

  const stem = `000-Tab-${Date.now()}`;
  await createNamedNote(page, stem);
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

  await expect
    .poll(async () => {
      const response = await page.request.get("/api/notes");
      const body = (await response.json()) as { notes: Array<{ path: string }> };
      const paths = new Set(body.notes.map((note) => note.path));
      return paths.has(renamedFile);
    })
    .toBe(true);
});

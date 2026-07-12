import { expect, test } from "@playwright/test";
import { createNamedNote } from "./test-helpers";

test("explorer: rename a note via the right-click menu", async ({ page }) => {
  await page.goto("/");

  const stem = `000-Explorer-${Date.now()}`;
  await createNamedNote(page, stem);
  const rendered = page.locator(".ProseMirror").first();
  await expect(rendered).toBeVisible();
  await rendered.click();
  await page.keyboard.type("keep me");
  const path = (await page.locator(".status-path").textContent())?.trim() ?? "";
  const name = path.split("/").pop() ?? "";
  expect(name).toBe(`${stem}.md`);

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

  await expect
    .poll(async () => {
      const response = await page.request.get("/api/notes");
      const body = (await response.json()) as { notes: Array<{ path: string }> };
      const paths = new Set(body.notes.map((note) => note.path));
      return paths.has(renamed);
    })
    .toBe(true);
});

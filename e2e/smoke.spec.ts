import { expect, test } from "@playwright/test";
import { createNewNote } from "./test-helpers";

test("app shell: create note, preview, split pane, theme, palette", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("📓 Notes")).toBeVisible();

  // Create a note (self-contained, independent of existing Tome content).
  await createNewNote(page);
  await createNewNote(page);

  // The note opens in a tab with the rendered (WYSIWYG) editor.
  await expect(page.locator(".ProseMirror")).toBeVisible();

  // Open the split dropdown and split the pane into two.
  const tab = page.locator(".workspace .tab").first();
  await tab.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Split & move right" }).first().click();
  await expect(page.locator(".workspace .island")).toHaveCount(2);

  // Toggle the theme (cycle: system → light → dark) and confirm it applies.
  await page.getByRole("button", { name: "Cycle mode (Light/Dark/System)" }).click();
  await page.getByRole("button", { name: "Cycle mode (Light/Dark/System)" }).click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.theme ?? ""))
    .toBe("dark");

  // Command palette opens via keyboard.
  await page.keyboard.press("Control+KeyP");
  await expect(page.getByTestId("palette-input")).toBeVisible();
});

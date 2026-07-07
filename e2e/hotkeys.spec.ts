import { expect, test } from "@playwright/test";

test("hotkeys: rebind the command palette shortcut and use it", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Settings" }).click();
  const combo = page.getByTestId("hotkey-command-palette");
  await expect(combo).toBeVisible();

  // Capture a new combo for the command palette.
  await combo.click();
  await expect(combo).toHaveText("Press keys…");
  await page.keyboard.press("Control+Shift+K");
  await expect(combo).toHaveText("Ctrl+Shift+K");

  // Close settings, then the new shortcut should open the palette.
  await page.getByRole("button", { name: "Close settings" }).click();
  await page.keyboard.press("Control+Shift+K");
  await expect(page.getByTestId("palette-input")).toBeVisible();
});

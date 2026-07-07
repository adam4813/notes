import { expect, test } from "@playwright/test";

test("plugins: enable and disable the Word Count sample from settings", async ({ page }) => {
  await page.goto("/");

  // Open a note so the Word Count status item has content to report.
  await page.getByRole("button", { name: "＋ New note" }).click();
  await expect(page.locator(".ProseMirror")).toBeVisible();

  // Open Settings and enable the Word Count plugin.
  await page.getByRole("button", { name: "Settings" }).click();
  const toggle = page.getByTestId("plugin-toggle-word-count");
  await expect(toggle).toBeVisible();
  await toggle.check();

  // Close settings; the status-bar item should now be present.
  await page.getByRole("button", { name: "Close settings" }).click();
  await expect(page.locator(".plugin-word-count")).toContainText("words");

  // Disable it again; the status-bar item disappears.
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByTestId("plugin-toggle-word-count").uncheck();
  await page.getByRole("button", { name: "Close settings" }).click();
  await expect(page.locator(".plugin-word-count")).toHaveCount(0);
});

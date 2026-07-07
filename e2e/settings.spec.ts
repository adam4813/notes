import { expect, test } from "@playwright/test";

test("settings: 'open in tab' preference opens settings as a workspace tab", async ({ page }) => {
  await page.goto("/");

  // Open the settings dialog and switch it to open-in-tab mode.
  await page.getByRole("button", { name: "Settings" }).click();
  const dialog = page.locator(".modal");
  await expect(dialog).toBeVisible();
  await page.getByTestId("settings-open-in-tab").check();

  // The dialog is replaced by a Settings tab in the workspace.
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".settings-view-header h2")).toHaveText("Settings");

  // Turning the option off from the tab closes the tab and reopens the dialog.
  await page.getByTestId("settings-open-in-tab").uncheck();
  await expect(page.locator(".settings-view")).toHaveCount(0);
  await expect(page.locator(".modal")).toBeVisible();
});

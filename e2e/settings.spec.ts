import { expect, test } from "@playwright/test";

test("settings: vertical tabs group sections and switch panels", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Settings" }).click();
  const dialog = page.locator(".modal");
  await expect(dialog).toBeVisible();

  // The settings surface uses a vertical tab rail.
  const tablist = dialog.getByRole("tablist", { name: "Settings sections" });
  await expect(tablist).toBeVisible();

  // General is the default tab; its controls are visible.
  await expect(page.getByTestId("settings-open-in-tab")).toBeVisible();
  await expect(page.getByTestId("app-font-size")).toHaveCount(0);

  // Switching to Appearance reveals appearance controls and hides General's.
  await tablist.getByRole("tab", { name: "Appearance" }).click();
  await expect(page.getByTestId("app-font-size")).toBeVisible();
  await expect(page.getByTestId("settings-open-in-tab")).toHaveCount(0);

  // Switching to Plugins reveals the plugin section.
  await tablist.getByRole("tab", { name: "Plugins" }).click();
  await expect(page.getByRole("heading", { name: "Plugins" })).toBeVisible();
});

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

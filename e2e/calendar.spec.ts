import { expect, test } from "@playwright/test";

test("calendar note: create, switch views, and add an event", async ({ page }) => {
  await page.goto("/");

  await page.getByTitle("Command palette (Ctrl/Cmd+P)").click();
  await page.getByTestId("palette-input").fill("New calendar");
  await page.getByRole("button", { name: "New calendar", exact: true }).click();

  // The month grid renders with a title.
  await expect(page.getByTestId("calendar-grid")).toBeVisible();
  await expect(page.getByTestId("calendar-title")).toBeVisible();

  // Add an event to the first in-month day cell.
  page.once("dialog", (dialog) => dialog.accept("Zephyr Standup"));
  await page.locator(".calendar-cell:not(.calendar-cell--muted)").first().click();

  // The event appears in the agenda view.
  await page.getByRole("tab", { name: "Agenda" }).click();
  await expect(page.getByTestId("calendar-agenda")).toContainText("Zephyr Standup");
});

import { expect, test } from "@playwright/test";

test("calendar note: create, switch views, and add an event", async ({ page }) => {
  await page.goto("/");

  await page.getByTitle("Command palette (Ctrl/Cmd+P)").click();
  await page.getByTestId("palette-input").fill("New calendar");
  await page.getByRole("button", { name: "New calendar", exact: true }).click();

  // The month grid renders with a title.
  await expect(page.getByTestId("calendar-grid")).toBeVisible();
  await expect(page.getByTestId("calendar-title")).toBeVisible();

  // Add an event to the first in-month day cell via the event panel.
  await page.locator(".calendar-cell:not(.calendar-cell--muted)").first().click();
  const panel = page.locator(".calendar-event-panel");
  await expect(panel).toBeVisible();
  await panel.getByLabel("Title").fill("Zephyr Standup");
  await panel.getByLabel("Time").fill("09:30");

  // The event appears in the agenda view with its time.
  await page.getByRole("tab", { name: "Agenda" }).click();
  await expect(page.getByTestId("calendar-agenda")).toContainText("Zephyr Standup");
  await expect(page.getByTestId("calendar-agenda")).toContainText("09:30");
});

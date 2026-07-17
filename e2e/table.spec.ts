import { expect, test } from "@playwright/test";

test("table note: create, edit a cell, add a column, and persist", async ({ page }) => {
  await page.goto("/");

  // Create a table note via the command palette (ribbon button waits for mount).
  await page.getByTitle("Command palette (Ctrl/Cmd+P)").click();
  await page.getByTestId("palette-input").fill("New table");
  await page.getByRole("button", { name: "New table", exact: true }).click();

  const grid = page.locator(".data-grid");
  await expect(grid).toBeVisible();
  await expect(page.locator(".grid-head-name").first()).toHaveText("Name");

  // Edit the first cell.
  await page.locator(".table-grid-cell").first().dblclick();
  await page.locator(".grid-input").fill("Hello table");
  await page.keyboard.press("Enter");
  await expect(page.locator(".grid-value").first()).toHaveText("Hello table");

  // Add a column (default table has 3 → expect 4).
  await page.getByRole("button", { name: "＋ Column" }).click();
  await expect(page.locator(".grid-head-name")).toHaveCount(4);

  // Select cells show an always-on dropdown (no double-click needed).
  const statusSelect = page.locator(".grid-select").first();
  await statusSelect.selectOption("Done");
  await expect(statusSelect).toHaveValue("Done");

  // Confirm it persisted to disk (autosave is debounced, so poll the file).
  const path = (await page.locator(".status-path").textContent())?.trim() ?? "";
  expect(path).toMatch(/New Table.*\.md/);
  await expect
    .poll(
      async () => {
        const response = await page.request.get(`/api/file?path=${encodeURIComponent(path)}`);
        return ((await response.json()) as { content: string }).content;
      },
      { timeout: 10_000 },
    )
    .toContain("Hello table");
});

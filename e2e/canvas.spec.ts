import { expect, test } from "@playwright/test";

test("canvas note: create, add a text node, and persist", async ({ page }) => {
  await page.goto("/");

  await page.getByTitle("Command palette (Ctrl/Cmd+P)").click();
  await page.getByTestId("palette-input").fill("New canvas");
  await page.getByRole("button", { name: "New canvas", exact: true }).click();

  await expect(page.getByTestId("canvas-viewport")).toBeVisible();

  // Add a text node.
  await page.getByRole("button", { name: "＋ Text" }).click();
  await expect(page.locator(".canvas-node--text")).toHaveCount(1);
  await expect(page.locator(".canvas-text")).toContainText("New note");

  // Confirm it persisted as JSONCanvas (autosave is debounced → poll).
  const path = (await page.locator(".status-path").textContent())?.trim() ?? "";
  expect(path).toMatch(/New Canvas.*\.canvas/);
  await expect
    .poll(
      async () => {
        const response = await page.request.get(`/api/file?path=${encodeURIComponent(path)}`);
        return ((await response.json()) as { content: string }).content;
      },
      { timeout: 10_000 },
    )
    .toContain('"type": "text"');
});

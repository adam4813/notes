import { expect, test } from "@playwright/test";

test("board note: create, add a card, and persist", async ({ page }) => {
  await page.goto("/");

  await page.getByTitle("Command palette (Ctrl/Cmd+P)").click();
  await page.getByTestId("palette-input").fill("New board");
  await page.getByRole("button", { name: "New board", exact: true }).click();

  await expect(page.locator(".board-column").first()).toBeVisible();

  // Add a card to the first column.
  await page.locator(".board-add-card").first().click();
  await page.locator(".board-add-input").fill("My new card");
  await page.keyboard.press("Enter");
  await expect(page.locator(".board-card-text", { hasText: "My new card" })).toBeVisible();

  // Confirm it persisted to the markdown-backed board.
  const path = (await page.locator(".status-path").textContent())?.trim() ?? "";
  expect(path).toMatch(/New Board.*\.md/);
  await expect
    .poll(
      async () => {
        const response = await page.request.get(`/api/file?path=${encodeURIComponent(path)}`);
        return ((await response.json()) as { content: string }).content;
      },
      { timeout: 10_000 },
    )
    .toContain("My new card");
});

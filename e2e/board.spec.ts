import { expect, test } from "@playwright/test";

test("board note: create, add a card, and persist", async ({ page }) => {
  await page.goto("/");

  await page.getByTitle("Command palette (Ctrl/Cmd+P)").click();
  await page.getByTestId("palette-input").fill("New board");
  await page.getByRole("button", { name: "New board", exact: true }).click();

  await expect(page.locator(".board-column").first()).toBeVisible();

  // Add a card to the first column, then edit its title.
  const cards = page.locator(".board-card");
  const before = await cards.count();
  await page.locator(".board-add-card").first().click();
  await expect(cards).toHaveCount(before + 1);

  const createdCard = cards.nth(before);
  await createdCard.click();
  await createdCard.locator(".board-card-title-input").fill("My new card");
  await createdCard.getByRole("button", { name: "Collapse card" }).click();
  await expect(page.locator(".board-card-title", { hasText: "My new card" })).toBeVisible();

  // Confirm the card title persisted to the board card store.
  const path = (await page.locator(".status-path").textContent())?.trim() ?? "";
  expect(path).toMatch(/New Board.*\.md/);
  await expect
    .poll(
      async () => {
        const response = await page.request.get(`/api/cards?boardPath=${encodeURIComponent(path)}`);
        const body = (await response.json()) as { cards: Array<{ title: string }> };
        return body.cards.some((card) => card.title === "My new card");
      },
      { timeout: 10_000 },
    )
    .toBe(true);
});

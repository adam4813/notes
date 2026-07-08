import { expect, test } from "@playwright/test";

test("search: find a note by content and open it from the search pane", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "＋ New note" }).click();

  const rendered = page.locator(".ProseMirror").first();
  await rendered.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type("zephyrsearchword appears here");

  // Wait for autosave + index to pick up the new content.
  await expect
    .poll(
      async () => {
        const response = await page.request.get("/api/search?q=zephyrsearchword");
        const body = (await response.json()) as { results: unknown[] };
        return body.results.length;
      },
      { timeout: 15_000 },
    )
    .toBeGreaterThan(0);

  await page.getByTestId("sidebar-view-search").click();
  await page.getByTestId("search-input").fill("zephyrsearchword");

  const result = page.locator(".search-result").first();
  await expect(result).toBeVisible();
  await expect(result.locator("mark")).toContainText("zephyrsearchword");
  await result.click();

  // The clicked result opens/activates a note tab.
  await expect(page.locator(".ProseMirror").first()).toBeVisible();
});

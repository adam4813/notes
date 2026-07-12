import { expect, test } from "@playwright/test";
import { createNewNote } from "./test-helpers";

test("tags: the tag pane lists a tag and filters search by it", async ({ page }) => {
  await page.goto("/");
  await createNewNote(page);

  const rendered = page.locator(".ProseMirror").first();
  await rendered.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type("tagged note with #zephyrtagword inside");

  // Wait for the index to register the tag.
  await expect
    .poll(
      async () => {
        const response = await page.request.get("/api/tags");
        const body = (await response.json()) as { tags: { tag: string }[] };
        return body.tags.some((entry) => entry.tag === "zephyrtagword");
      },
      { timeout: 15_000 },
    )
    .toBe(true);

  await page.getByTestId("sidebar-view-tags").click();
  const tag = page.getByTestId("tag-zephyrtagword");
  await expect(tag).toBeVisible();
  await tag.click();

  // Clicking a tag switches to the search view with the tag filter applied,
  // and filter-only search (no text query) lists the tagged note.
  await expect(page.getByTestId("search-input")).toBeVisible();
  await expect(page.getByLabel("Filter by tag")).toHaveValue("zephyrtagword");
  await expect(page.locator(".search-result").first()).toBeVisible();
});

import { expect, test } from "@playwright/test";
import { createNewNote } from "./test-helpers";

test("layout: open tabs are restored after a reload", async ({ page }) => {
  await page.goto("/");

  await createNewNote(page);
  await expect(page.locator(".ProseMirror").first()).toBeVisible();
  const title =
    (await page.locator(".tab--active .tab__title").first().textContent())?.trim() ?? "";
  expect(title.length).toBeGreaterThan(0);

  await page.reload();

  // The previously-open tab and its editor come back.
  await expect(page.locator(".tab", { hasText: title })).toBeVisible();
  await expect(page.locator(".ProseMirror").first()).toBeVisible();
});

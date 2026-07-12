import { expect, test } from "@playwright/test";
import { createNewNote } from "./test-helpers";

test("find: in-note find counts matches and replace-all rewrites them", async ({ page }) => {
  await page.goto("/");
  await createNewNote(page);

  // Use the source (Edit) mode for deterministic text.
  await page.getByRole("tab", { name: "Edit", exact: true }).click();
  const source = page.locator(".cm-content");
  await source.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type("alpha beta alpha");

  // Open the find bar via the toolbar button, then search.
  await page.getByRole("button", { name: "Find in note" }).click();
  await expect(page.getByTestId("find-input")).toBeVisible();
  await page.getByTestId("find-input").fill("alpha");
  await expect(page.getByTestId("find-count")).toHaveText("1/2");

  // Replace all occurrences.
  await page.getByTestId("find-input").press("Enter"); // move to next, still 2 matches
  await page.locator(".find-toggle").click();
  await page.getByTestId("replace-input").fill("gamma");
  await page.getByTestId("replace-all").click();

  await expect(page.locator(".cm-content")).toContainText("gamma beta gamma");
});

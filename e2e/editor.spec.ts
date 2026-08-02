import { expect, test } from "@playwright/test";
import { createNewNote } from "./test-helpers";

test("editor round-trips rendered edits into the markdown source", async ({ page }) => {
  await page.goto("/");
  await createNewNote(page);

  const rendered = page.locator(".ProseMirror").first();
  await expect(rendered).toBeVisible();
  await expect(rendered).toContainText("New Note");

  // Type into the rendered (WYSIWYG) editor.
  await rendered.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type("A brand new sentence.");

  // Switch to Edit (source) mode; the textarea source reflects the edit.
  await page.getByRole("tab", { name: "Edit", exact: true }).click();
  await expect(page.locator(".source-editor")).toContainText("A brand new sentence.");

  // Split mode shows both editors.
  await page.getByRole("tab", { name: "Split", exact: true }).click();
  await expect(page.locator(".source-editor")).toBeVisible();
  await expect(page.locator(".ProseMirror")).toBeVisible();
});

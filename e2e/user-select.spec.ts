import { expect, test } from "@playwright/test";
import { createNewNote } from "./test-helpers";

// The app uses an inverted selection model: chrome is non-selectable by default
// (user-select: none inherited from :root) and text selection is opted back in
// only for content and form controls.
test("user-select: chrome is non-selectable while editor and inputs are selectable", async ({
  page,
}) => {
  await page.goto("/");

  // App chrome defaults to non-selectable.
  await expect(page.locator(".ribbon")).toHaveCSS("user-select", "none");

  // Form controls are opted back into text selection.
  await expect(page.getByLabel("Search notes")).toHaveCSS("user-select", "text");

  // The rendered (TipTap) editor content stays selectable/copyable.
  await createNewNote(page);
  await expect(page.locator(".ProseMirror").first()).toHaveCSS("user-select", "text");

  // The markdown source editor is selectable too.
  await page.getByRole("tab", { name: "Edit", exact: true }).click();
  await expect(page.locator(".source-editor")).toHaveCSS("user-select", "text");
});

import { expect, test } from "@playwright/test";
import { createNewNote } from "./test-helpers";

test("version history: save a version and view its diff", async ({ page }) => {
  await page.goto("/");
  await createNewNote(page);

  const rendered = page.locator(".ProseMirror").first();
  await expect(rendered).toBeVisible();

  const notePath = (await page.locator(".status-path").textContent())?.trim() ?? "";
  expect(notePath).not.toBe("");

  // Make this note unique so it differs from any state a previous run committed.
  const stamp = Date.now();
  const marker = `history marker ${stamp}`;
  const description = `snapshot ${stamp}`;
  await rendered.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(marker);

  // Wait for debounced autosave to persist the content before snapshotting.
  await expect
    .poll(async () => {
      const response = await page.request.get(`/api/file?path=${encodeURIComponent(notePath)}`);
      const body = (await response.json()) as { content: string };
      return body.content;
    })
    .toContain(marker);

  // Save a version from the Version history panel section.
  await page.getByRole("textbox", { name: "Version description" }).fill(description);
  await page.getByRole("button", { name: "Save version" }).click();

  // The saved version appears in the list.
  const versionItem = page.getByRole("button", { name: description });
  await expect(versionItem).toBeVisible();

  // Selecting it swaps the editor for a read-only diff of what it changed.
  await versionItem.click();
  await expect(page.getByText("Viewing an earlier version")).toBeVisible();
  const diffRows = page.getByRole("list", { name: "Version differences" }).getByRole("listitem");
  await expect(diffRows.first()).toBeVisible();

  // Returning to the current note restores the editor.
  await page.getByRole("button", { name: "Back to current" }).click();
  await expect(rendered).toBeVisible();
  await expect(page.getByText("Viewing an earlier version")).toHaveCount(0);
});

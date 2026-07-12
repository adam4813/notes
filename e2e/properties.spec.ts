import { expect, test } from "@playwright/test";
import { createNewNote } from "./test-helpers";

test("properties: add a frontmatter property from the panel and persist it", async ({ page }) => {
  await page.goto("/");
  await createNewNote(page);
  await expect(page.locator(".ProseMirror").first()).toBeVisible();
  const notePath = (await page.locator(".status-path").textContent())?.trim() ?? "";

  // Add a property via the always-visible Properties panel.
  await page.getByRole("button", { name: "＋ Add property" }).click();
  const row = page.locator(".property-row--edit").last();
  const keyInput = row.locator(".property-input--key");
  const valueInput = row.locator(".property-input").nth(1);
  await keyInput.fill("status");
  await valueInput.fill("draft");
  await expect(valueInput).toHaveValue("draft");
  await page.getByText("Properties").click();

  // The frontmatter is written to the file on disk.
  await expect
    .poll(async () => {
      const response = await page.request.get(`/api/file?path=${encodeURIComponent(notePath)}`);
      const body = (await response.json()) as { content: string };
      return body.content;
    })
    .toContain("status: draft");
});

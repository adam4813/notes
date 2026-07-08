import { expect, test } from "@playwright/test";

test("properties: add a frontmatter property from the panel and persist it", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "＋ New note" }).click();
  await expect(page.locator(".ProseMirror").first()).toBeVisible();
  const notePath = (await page.locator(".status-path").textContent())?.trim() ?? "";

  // Add a property via the always-visible Properties panel.
  await page.getByRole("button", { name: "＋ Add property" }).click();
  await page.getByLabel("Property name").last().fill("status");
  await page.getByLabel(/Value for/).last().fill("draft");
  await page.getByLabel(/Value for/).last().blur();

  // The frontmatter is written to the file on disk.
  await expect
    .poll(async () => {
      const response = await page.request.get(`/api/file?path=${encodeURIComponent(notePath)}`);
      const body = (await response.json()) as { content: string };
      return body.content;
    })
    .toContain("status: draft");
});

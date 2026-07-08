import { expect, test } from "@playwright/test";

test("embed: a markdown note embeds another note's widget and round-trips", async ({ page }) => {
  await page.goto("/");

  // Create a table note to embed.
  await page.getByTitle("Command palette (Ctrl/Cmd+P)").click();
  await page.getByTestId("palette-input").fill("New table");
  await page.getByRole("button", { name: "New table", exact: true }).click();
  await expect(page.locator(".data-grid")).toBeVisible();

  // Wait for the index to resolve the target by name.
  await expect
    .poll(async () => {
      const response = await page.request.get(
        `/api/resolve?text=${encodeURIComponent("New Table")}`,
      );
      const body = (await response.json()) as { path: string | null };
      return body.path;
    }, { timeout: 15_000 })
    .not.toBeNull();

  // Create a markdown note and embed the table via ![[...]].
  await page.getByRole("button", { name: "＋ New note" }).click();
  const rendered = page.locator(".ProseMirror").first();
  await rendered.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type("![[New Table]]");
  await page.keyboard.press("Escape");

  // The embed card renders with the table widget inside the markdown note.
  await expect(page.locator(".embed-card")).toBeVisible();
  await expect(page.locator(".embed-type")).toContainText("Table");
  await expect(page.locator(".embed-body .data-grid")).toBeVisible();

  // The markdown source round-trips to ![[New Table]].
  const notePath = (await page.locator(".status-path").textContent())?.trim() ?? "";
  await expect
    .poll(async () => {
      const response = await page.request.get(`/api/file?path=${encodeURIComponent(notePath)}`);
      const body = (await response.json()) as { content: string };
      return body.content;
    }, { timeout: 15_000 })
    .toContain("![[New Table]]");
});

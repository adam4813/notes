import { expect, test } from "@playwright/test";
import { createNewNote } from "./test-helpers";

test("offline: edits are buffered locally and synced on reconnect", async ({ page, context }) => {
  await page.goto("/");
  await createNewNote(page);
  const rendered = page.locator(".ProseMirror").first();
  await rendered.click();
  const notePath = (await page.locator(".status-path").textContent())?.trim() ?? "";

  // Go offline and make an edit — the autosave should buffer it locally.
  await context.setOffline(true);
  await page.keyboard.press("Control+End");
  await page.keyboard.type("offlineword");
  await expect(page.locator(".save-status--offline")).toBeVisible({ timeout: 8000 });

  // Reconnect: the buffered edit flushes to disk.
  await context.setOffline(false);
  await expect
    .poll(
      async () => {
        const response = await page.request.get(`/api/file?path=${encodeURIComponent(notePath)}`);
        const body = (await response.json()) as { content: string };
        return body.content;
      },
      { timeout: 15_000 },
    )
    .toContain("offlineword");
});

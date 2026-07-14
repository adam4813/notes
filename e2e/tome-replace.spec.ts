import { expect, test } from "@playwright/test";
import { createNewNote } from "./test-helpers";

test("tome replace: find and replace a token across the Tome", async ({ page }) => {
  await page.goto("/");
  await createNewNote(page);
  const rendered = page.locator(".ProseMirror").first();
  await rendered.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type("zebratoken appears here");
  const notePath = (await page.locator(".status-path").textContent())?.trim() ?? "";

  // Wait for the index to see the token.
  await expect
    .poll(
      async () => {
        const response = await page.request.get("/api/search?q=zebratoken");
        const body = (await response.json()) as { results: unknown[] };
        return body.results.length;
      },
      { timeout: 15_000 },
    )
    .toBeGreaterThan(0);

  // Open Tome-wide replace via the command palette.
  await page.getByTitle("Command palette (Ctrl/Cmd+P)").click();
  await page.getByTestId("palette-input").fill("Find & replace in Tome");
  await page.getByRole("button", { name: "Find & replace in Tome", exact: true }).click();

  await page.getByTestId("tome-find").fill("zebratoken");
  await page.getByTestId("tome-replace").fill("giraffeword");
  const runButton = page.getByTestId("tome-replace-run");
  await expect(runButton).toBeEnabled({ timeout: 15_000 });
  await runButton.click();

  // The file on disk reflects the replacement.
  await expect
    .poll(async () => {
      const response = await page.request.get(`/api/file?path=${encodeURIComponent(notePath)}`);
      const body = (await response.json()) as { content: string };
      return body.content;
    })
    .toContain("giraffeword");
});

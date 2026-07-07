import { expect, test } from "@playwright/test";

test("a markdown note can wikilink to a canvas and navigate to it", async ({ page }) => {
  await page.goto("/");

  // Create a canvas note.
  await page.getByTitle("Command palette (Ctrl/Cmd+P)").click();
  await page.getByTestId("palette-input").fill("New canvas");
  await page.getByRole("button", { name: "New canvas" }).click();
  await expect(page.getByTestId("canvas-viewport")).toBeVisible();

  const canvasPath = (await page.locator(".status-path").textContent())?.trim() ?? "";
  const canvasName = canvasPath.replace(/\.canvas$/, "");

  // Wait for the canvas to be indexed (so it is linkable).
  await expect
    .poll(
      async () => {
        const response = await page.request.get("/api/notes");
        const body = (await response.json()) as { notes: { path: string }[] };
        return body.notes.some((note) => note.path === canvasPath);
      },
      { timeout: 15_000 },
    )
    .toBe(true);

  // Create a markdown note and insert a wikilink to the canvas via autocomplete.
  await page.getByRole("button", { name: "＋ New note" }).click();
  const rendered = page.locator(".ProseMirror").first();
  await rendered.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(`[[${canvasName}`);
  await expect(page.locator(".suggest-popup")).toBeVisible();
  await page.keyboard.press("Enter");

  // Click the rendered wikilink → the canvas opens.
  await page.locator(".ProseMirror .wikilink").first().click();
  await expect(page.getByTestId("canvas-viewport")).toBeVisible();
});

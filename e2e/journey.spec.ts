import { expect, test } from "@playwright/test";
import { createNamedNote, openNotePicker } from "./test-helpers";

// A representative end-to-end journey across the core MVP flows.
test("core journey: link + backlink, table, palette theme, and reload persists", async ({
  page,
}) => {
  await page.goto("/");
  const token = `J${Date.now()}`;
  const target = `Target${token}`;
  const source = `Source${token}`;

  // Create the target note via the note picker create-on-miss flow.
  await createNamedNote(page, target);
  await expect(page.locator(".ProseMirror").first()).toBeVisible();

  // Create the source note and link it to the target.
  await createNamedNote(page, source);
  const editor = page.locator(".ProseMirror").first();
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(`links to [[${target}]]`);
  await page.keyboard.press("Escape");

  // Wait for the index to register the link.
  await expect
    .poll(
      async () => {
        const response = await page.request.get(
          `/api/backlinks?path=${encodeURIComponent(`${target}.md`)}`,
        );
        const body = (await response.json()) as { backlinks: { title: string }[] };
        return body.backlinks.some((b) => b.title === source);
      },
      { timeout: 15_000 },
    )
    .toBe(true);

  // Open the target and confirm the backlink shows in the right panel.
  await openNotePicker(page);
  await page.getByTestId("palette-input").fill(target);
  await page.getByRole("button", { name: `${target}.md`, exact: true }).click();
  await expect(page.locator(".backlink", { hasText: source })).toBeVisible();

  // Create a table via the command palette.
  await page.getByTitle("Command palette (Ctrl/Cmd+P)").click();
  await page.getByTestId("palette-input").fill("New table");
  await page.getByRole("button", { name: "New table", exact: true }).click();
  await expect(page.locator(".data-grid")).toBeVisible();

  // Toggle the theme via the command palette.
  await page.getByTitle("Command palette (Ctrl/Cmd+P)").click();
  await page.getByTestId("palette-input").fill("Dark");
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.theme ?? ""))
    .toBe("dark");

  // Reload: files persist on disk and reappear in the explorer.
  await page.reload();
  await expect
    .poll(async () => {
      const response = await page.request.get(
        `/api/file?path=${encodeURIComponent(`${target}.md`)}`,
      );
      return response.ok();
    })
    .toBe(true);
});

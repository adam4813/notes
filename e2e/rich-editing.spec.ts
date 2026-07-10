import { expect, test } from "@playwright/test";

test("toolbar applies bold formatting in the rendered editor", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "＋ New note" }).click();

  const rendered = page.locator(".ProseMirror").first();
  await expect(rendered).toBeVisible();
  await rendered.click();
  await page.getByTitle("Bold (Ctrl+B)").click();
  await page.keyboard.type("bold me");
  await expect(rendered.locator("strong")).toContainText("bold me");
});

test("note editor context menu is available in rendered and edit modes", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "＋ New note" }).click();

  const rendered = page.locator(".ProseMirror").first();
  await expect(rendered).toBeVisible();
  await rendered.click({ button: "right" });

  const menu = page.locator(".editor-context-menu");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Undo" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Redo" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Cut" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Copy" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Paste" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Select all" })).toBeVisible();

  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "Edit", exact: true }).click();
  await page.locator(".cm-content").first().click({ button: "right" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Undo" })).toBeVisible();
});

test("manually authored img tag renders in rendered mode", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "＋ New note" }).click();
  await page.getByRole("tab", { name: "Edit", exact: true }).click();

  const source = page.locator(".cm-content");
  await expect(source).toBeVisible();
  await source.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(
    '\n<img src="https://example.com/external-image.png" alt="External image" title="External title" />',
  );

  await page.getByRole("tab", { name: "Rendered", exact: true }).click();
  const renderedImage = page.locator('.ProseMirror img[alt="External image"]').first();
  await expect(renderedImage).toHaveAttribute("src", "https://example.com/external-image.png");
  await expect(renderedImage).toHaveAttribute("title", "External title");
});

test("undo in rendered mode does not clear content after switching modes", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "＋ New note" }).click();

  const rendered = page.locator(".ProseMirror").first();
  await expect(rendered).toBeVisible();
  await rendered.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type("keep this text");

  await page.getByRole("tab", { name: "Edit", exact: true }).click();
  await page.getByRole("tab", { name: "Rendered", exact: true }).click();

  await rendered.click();
  await page.keyboard.press("Control+Z");
  await expect(rendered).toContainText("keep this text");
});

test("wikilink autocomplete inserts a link from the index", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "＋ New note" }).click();

  // Wait until the index has picked up at least one note.
  await expect
    .poll(
      async () => {
        const response = await page.request.get("/api/notes");
        const body = (await response.json()) as { notes: unknown[] };
        return body.notes.length;
      },
      { timeout: 15_000 },
    )
    .toBeGreaterThan(0);

  const rendered = page.locator(".ProseMirror").first();
  await rendered.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type("[[New");

  await expect(page.locator(".suggest-popup")).toBeVisible();
  await page.keyboard.press("Enter");

  await page.getByRole("tab", { name: "Edit", exact: true }).click();
  await expect(page.locator(".cm-content")).toContainText("[[New");
});

test("tab indents a list item into a nested list", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "＋ New note" }).click();

  const rendered = page.locator(".ProseMirror").first();
  await rendered.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type("- first");
  await page.keyboard.press("Enter");
  await page.keyboard.type("second");
  await page.keyboard.press("Tab");

  await expect(rendered.locator("ul ul")).toBeVisible();
});

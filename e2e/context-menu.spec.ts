import { expect, test, type Page } from "@playwright/test";
import { createNewNote } from "./test-helpers";

/** Creates a note type via the command palette (e.g. "New canvas"). */
async function createViaPalette(page: Page, query: string, button: string): Promise<void> {
  await page.getByTitle("Command palette (Ctrl/Cmd+P)").click();
  await page.getByTestId("palette-input").fill(query);
  await page.getByRole("button", { name: button, exact: true }).click();
}

test("canvas right-click shows canvas actions on empty space and on a node", async ({ page }) => {
  await page.goto("/");
  await createViaPalette(page, "New canvas", "New canvas");

  const viewport = page.getByTestId("canvas-viewport");
  await expect(viewport).toBeVisible();

  // Empty canvas → add/fit actions instead of generic clipboard commands.
  await viewport.click({ button: "right", position: { x: 30, y: 30 } });
  const menu = page.locator(".context-menu");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Add Text" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Fit View" })).toBeVisible();
  await page.keyboard.press("Escape");

  // A node → delete action (no empty / irrelevant menu).
  await page.getByRole("button", { name: "＋ Text" }).click();
  const node = page.locator(".canvas-node--text").first();
  await expect(node).toBeVisible();
  await node.click({ button: "right" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Delete", exact: true })).toBeVisible();
});

test("board right-click shows column and card actions", async ({ page }) => {
  await page.goto("/");
  await createViaPalette(page, "New board", "New board");

  const column = page.locator(".board-column").first();
  await expect(column).toBeVisible();

  // Right-click a column → board actions (no more empty menu).
  await column.click({ button: "right" });
  const menu = page.locator(".context-menu");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Add card" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Rename column" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Delete column" })).toBeVisible();
  await page.keyboard.press("Escape");

  // Right-click a card → card actions.
  await page.locator(".board-add-card").first().click();
  const card = page.locator(".board-card").first();
  await expect(card).toBeVisible();
  await card.click({ button: "right" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Duplicate card" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Delete card" })).toBeVisible();
});

test("table right-click shows cell, row, and column actions", async ({ page }) => {
  await page.goto("/");
  await createViaPalette(page, "New table", "New table");

  await expect(page.locator(".data-grid")).toBeVisible();

  // Right-click a cell → cell / row / column actions.
  await page.locator(".table-grid-cell").first().click({ button: "right" });
  const menu = page.locator(".context-menu");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Copy", exact: true })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Clear cell" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Delete row" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Sort ascending" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Delete column" })).toBeVisible();
  await page.keyboard.press("Escape");

  // Right-click a column header → column actions.
  await page.locator(".grid-head").first().click({ button: "right" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Rename column" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Add column" })).toBeVisible();
});

test("rendered image right-click shows copy and delete image actions", async ({ page }) => {
  await page.goto("/");
  await createNewNote(page);

  // Author an <img> in the source pane, then switch to the rendered pane.
  await page.getByRole("tab", { name: "Edit", exact: true }).click();
  const source = page.locator(".source-editor");
  await expect(source).toBeVisible();
  await source.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type('\n<img src="https://example.com/pic.png" alt="pic" />');

  await page.getByRole("tab", { name: "Rendered", exact: true }).click();
  const image = page.locator('.ProseMirror img[alt="pic"]').first();
  await expect(image).toBeVisible();

  await image.click({ button: "right" });
  const menu = page.locator(".context-menu");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Copy Image", exact: true })).toBeVisible();
  await expect(
    menu.getByRole("menuitem", { name: "Copy Image Address", exact: true }),
  ).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Delete Image", exact: true })).toBeVisible();
});

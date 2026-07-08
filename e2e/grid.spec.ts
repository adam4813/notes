import { expect, test } from "@playwright/test";

test("grid note: create, paint a cell, and add a layer", async ({ page }) => {
  await page.goto("/");

  await page.getByTitle("Command palette (Ctrl/Cmd+P)").click();
  await page.getByTestId("palette-input").fill("New grid");
  await page.getByRole("button", { name: "New grid", exact: true }).click();

  const canvas = page.getByTestId("grid-canvas");
  await expect(canvas).toBeVisible();

  // Paint a cell (Paint tool + color are selected by default).
  await canvas.locator(".grid-cell").first().click({ force: true });
  await expect
    .poll(() =>
      canvas
        .locator(".grid-cell")
        .evaluateAll((cells) => cells.some((cell) => (cell as HTMLElement).style.background !== "")),
    )
    .toBe(true);

  // Add a second layer.
  await page.getByRole("button", { name: "Add layer" }).click();
  await expect(page.locator(".grid-layer")).toHaveCount(2);
});

import { expect, test } from "@playwright/test";

test("mermaid note: create, edit source, and render a diagram", async ({ page }) => {
  await page.goto("/");

  await page.getByTitle("Command palette (Ctrl/Cmd+P)").click();
  await page.getByTestId("palette-input").fill("New diagram");
  await page.getByRole("button", { name: "New diagram", exact: true }).click();

  // The Mermaid note renders its source + a diagram preview.
  await expect(page.getByTestId("mermaid-source")).toBeVisible();
  const image = page.getByTestId("mermaid-preview").locator("img");
  await expect(image).toBeVisible({ timeout: 15_000 });

  const oldSrc = (await image.getAttribute("src")) ?? "";

  // Editing the source updates the rendered diagram's image block
  const source = page.getByTestId("mermaid-source");
  await source.fill("flowchart LR\n  Zephyr --> Diagram");
  await expect(image).not.toHaveAttribute("src", oldSrc);
});

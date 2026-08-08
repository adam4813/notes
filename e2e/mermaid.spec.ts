import { expect, test } from "@playwright/test";

test("mermaid note: create, edit source, and render a diagram", async ({ page }) => {
  await page.goto("/");

  await page.getByTitle("Command palette (Ctrl/Cmd+P)").click();
  await page.getByTestId("palette-input").fill("New diagram");
  await page.getByRole("button", { name: "New diagram", exact: true }).click();

  const image = page.getByTestId("mermaid-preview").locator("img");
  await expect(image).toBeVisible({ timeout: 15_000 });

  const oldSrc = (await image.getAttribute("src")) ?? "";

  // Rendered is shown by default, switch to split so source can be modified
  await page.getByRole("tab", { name: "Split", exact: true }).click();

  // Editing the source updates the rendered diagram's image block
  const source = page.locator(".source-editor");
  // We need to maually set the frontmatter, for now
  // TODO: Remove manual frontmatter in spec test, once the NativeSourceEditor can use the correct serializer
  await source.fill("---\ntype: mermaid\n---\nflowchart LR\n  Zephyr --> Diagram");
  await expect(image).not.toHaveAttribute("src", oldSrc);
});

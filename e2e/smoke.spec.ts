import { expect, test } from "@playwright/test";

test("web app loads and reports the server as healthy", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Notes/i })).toBeVisible();

  const status = page.getByTestId("server-status");
  await expect(status).toHaveText(/ok/i, { timeout: 15_000 });
});

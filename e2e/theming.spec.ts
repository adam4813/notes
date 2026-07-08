import { expect, test } from "@playwright/test";

test("theming: accent color and theme apply from settings", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Settings" }).click();

  // Pick the blue accent preset and confirm the token updates.
  await page.getByTestId("accent-blue").click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.documentElement.style.getPropertyValue("--accent").trim(),
      ),
    )
    .toBe("#2563eb");

  // Switch to the dark theme via the segmented control.
  await page.getByRole("radio", { name: "Dark", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.theme ?? ""))
    .toBe("dark");

  // A built-in named theme also applies.
  await page.getByRole("radio", { name: "Solarized", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.theme ?? ""))
    .toBe("solarized");
});

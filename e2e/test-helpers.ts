import type { Page } from "@playwright/test";

export async function createNewNote(page: Page): Promise<void> {
  await page.getByRole("button", { name: "New", exact: true }).click();
  await page.getByRole("button", { name: "Markdown note", exact: true }).click();
}

export async function openNotePicker(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Open or create note" }).click();
}

export async function createNamedNote(page: Page, name: string): Promise<void> {
  await openNotePicker(page);
  await page.getByTestId("palette-input").fill(name);
  await page.getByRole("button", { name: `Create note "${name}"` }).click();
}

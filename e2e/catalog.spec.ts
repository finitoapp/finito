import { expect, test } from "@playwright/test";
import { seedCatalog } from "./helpers/harness";

const createUniqueLabel = (prefix: string) =>
	`${prefix} ${Date.now()} ${Math.round(Math.random() * 10_000)}`;

test("shows a seeded catalog item in the list and opens its detail", async ({
	page,
}) => {
	const label = createUniqueLabel("Catalog smoke");
	const seed = await seedCatalog(page, {
		name: "single-item",
		item: {
			label,
		},
	});
	if (!seed.item) {
		throw new Error("Expected a seeded item for the smoke scenario.");
	}

	await page.goto("/admin/catalog");
	await expect(page.getByRole("link", { name: label })).toBeVisible();

	await page.getByRole("link", { name: label }).click();

	await expect(page).toHaveURL(new RegExp(`/admin/catalog/detail\\?id=${seed.item.id}`));
	await expect(page.getByRole("heading", { name: label })).toBeVisible();
	await expect(page.getByText("Record ID")).toBeVisible();
	await expect(page.getByText(seed.item.id)).toBeVisible();
});

test("creates a new catalog item from the list page", async ({ page }) => {
	const label = createUniqueLabel("Catalog create");

	await seedCatalog(page, {
		name: "empty-catalog",
	});

	await page.goto("/admin/catalog");
	await Promise.all([
		page.waitForURL(/\/admin\/catalog\/new$/, { timeout: 20_000 }),
		page.getByRole("link", { name: "New item" }).click(),
	]);
	await page.locator('[name="label"]').fill(label);
	await page.locator('[name="price"]').fill("123");
	await page.getByRole("button", { name: "Save" }).click();

	await expect(page).toHaveURL(/\/admin\/catalog$/, { timeout: 20_000 });
	await expect(page.getByRole("link", { name: label })).toBeVisible();
});

test("deletes a catalog item from the detail menu", async ({ page }) => {
	const label = createUniqueLabel("Catalog delete");
	const seed = await seedCatalog(page, {
		name: "single-item",
		item: {
			label,
		},
	});
	if (!seed.item) {
		throw new Error("Expected a seeded item for the delete scenario.");
	}

	await page.goto(`/admin/catalog/detail?id=${seed.item.id}`);
	await page.getByRole("button", { name: "Actions" }).click();
	await page.getByRole("menuitem", { name: "Delete" }).click();
	await page
		.getByRole("alertdialog")
		.getByRole("button", { name: "Delete" })
		.click();

	await expect(page).toHaveURL(/\/admin\/catalog$/);
	await expect(page.getByRole("link", { name: label })).toHaveCount(0);
});

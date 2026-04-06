import { expect, test } from "./fixtures";
import categoriesLocale from "@/locales/en/categories";
import commonLocale from "@/locales/en/common";
import itemsLocale from "@/locales/en/items";

const createUniqueLabel = (prefix: string) =>
	`${prefix} ${Date.now()} ${Math.round(Math.random() * 10_000)}`;

const itemFormLabels = itemsLocale.form["item-form"].label;
const itemDetailFields = itemsLocale.detail.fields;
const itemDetailActions = itemsLocale.detail.actions;
const itemTableActions = itemsLocale.table.actions;
const categoryFormLabels = categoriesLocale.form["category-form"].label;
const categoryDetailActions = categoriesLocale.detail.actions;
const categoryDetailValues = categoriesLocale.detail.values;
const categoryTableActions = categoriesLocale.table.actions;
const commonTable = commonLocale.table;

test("shows a seeded catalog item in the list and opens its detail", async ({
	page,
	harness,
}) => {
	const label = createUniqueLabel("Catalog smoke");
	const seed = await harness.seedCatalog({
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
	await expect(page.getByText(itemDetailFields.recordId)).toBeVisible();
	await expect(page.getByText(seed.item.id)).toBeVisible();
});

test("creates a new catalog item from the list page", async ({
	page,
	harness,
}) => {
	const label = createUniqueLabel("Catalog create");

	await harness.seedCatalog({
		name: "empty-catalog",
	});

	await page.goto("/admin/catalog");
	await Promise.all([
		page.waitForURL(/\/admin\/catalog\/new$/, { timeout: 20_000 }),
		page.getByRole("link", { name: itemTableActions["new-item"] }).click(),
	]);
	await page.getByLabel(itemFormLabels.label).fill(label);
	await page.getByLabel(itemFormLabels.price).fill("123");
	await page.getByRole("button", { name: "Save" }).click();

	await expect(page).toHaveURL(/\/admin\/catalog$/, { timeout: 20_000 });
	await expect(page.getByRole("link", { name: label })).toBeVisible();
});

test("deletes a catalog item from the detail menu", async ({
	page,
	harness,
}) => {
	const label = createUniqueLabel("Catalog delete");
	const seed = await harness.seedCatalog({
		name: "single-item",
		item: {
			label,
		},
	});
	if (!seed.item) {
		throw new Error("Expected a seeded item for the delete scenario.");
	}

	await page.goto(`/admin/catalog/detail?id=${seed.item.id}`);
	await page.getByRole("button", { name: commonTable.actions }).click();
	await page.getByRole("menuitem", { name: itemDetailActions.delete }).click();
	await page
		.getByRole("alertdialog")
		.getByRole("button", { name: itemDetailActions.delete })
		.click();

	await expect(page).toHaveURL(/\/admin\/catalog$/);
	await expect(page.getByRole("link", { name: label })).toHaveCount(0);
});

test("creates a new catalog category from the categories page", async ({
	page,
	harness,
}) => {
	const name = createUniqueLabel("Catalog category");

	await harness.seedCatalog({
		name: "empty-catalog",
	});

	await page.goto("/admin/catalog");
	await Promise.all([
		page.waitForURL(/\/admin\/catalog\/categories$/, { timeout: 20_000 }),
		page.getByRole("button", { name: categoriesLocale.table.categories }).click(),
	]);
	await Promise.all([
		page.waitForURL(/\/admin\/catalog\/categories\/new$/, { timeout: 20_000 }),
		page.getByRole("link", { name: categoryTableActions["new-category"] }).click(),
	]);
	await page.getByLabel(categoryFormLabels.name).fill(name);
	await page.getByRole("button", { name: "Save" }).click();

	await expect(page).toHaveURL(/\/admin\/catalog\/categories$/, {
		timeout: 20_000,
	});
	await expect(page.getByRole("link", { name })).toBeVisible();
});

test("opens a linked category from the categories list and shows its usage", async ({
	page,
	harness,
}) => {
	const categoryName = createUniqueLabel("Catalog linked category");
	const seed = await harness.seedCatalog({
		name: "single-item",
		item: {
			label: createUniqueLabel("Catalog linked item"),
		},
		category: {
			name: categoryName,
		},
	});
	if (!seed.category) {
		throw new Error("Expected a seeded category for the linked category scenario.");
	}

	await page.goto("/admin/catalog/categories");
	await expect(page.getByRole("link", { name: categoryName })).toBeVisible();

	await page.getByRole("link", { name: categoryName }).click();

	await expect(page).toHaveURL(
		new RegExp(`/admin/catalog/categories/detail\\?id=${seed.category.id}`),
	);
	await expect(page.getByTestId("catalog-category-detail-name")).toContainText(
		categoryName,
	);
	await expect(page.getByTestId("catalog-category-items-count")).toHaveText("1");
	await expect(page.getByText(categoryDetailValues.inUse)).toBeVisible();
});

test("deletes a catalog category from the detail page", async ({
	page,
	harness,
}) => {
	const name = createUniqueLabel("Catalog category delete");
	const seed = await harness.seedCatalog({
		name: "single-category",
		category: {
			name,
		},
	});
	if (!seed.category) {
		throw new Error("Expected a seeded category for the delete scenario.");
	}

	await page.goto(`/admin/catalog/categories/detail?id=${seed.category.id}`);
	await page.getByRole("button", { name: categoryDetailActions.delete }).click();
	await page
		.getByRole("alertdialog")
		.getByRole("button", { name: categoryDetailActions.delete })
		.click();

	await expect(page).toHaveURL(/\/admin\/catalog\/categories$/);
	await expect(page.getByRole("link", { name })).toHaveCount(0);
});

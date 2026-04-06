import { expect, test } from "./fixtures";

const createUniqueLabel = (prefix: string) =>
	`${prefix} ${Date.now()} ${Math.round(Math.random() * 10_000)}`;

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
	await expect(page.getByText("Record ID")).toBeVisible();
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
		page.getByRole("link", { name: "New item" }).click(),
	]);
	await page.locator('[name="label"]').fill(label);
	await page.locator('[name="price"]').fill("123");
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
	await page.getByRole("button", { name: "Actions" }).click();
	await page.getByRole("menuitem", { name: "Delete" }).click();
	await page
		.getByRole("alertdialog")
		.getByRole("button", { name: "Delete" })
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
		page.getByRole("button", { name: "Categories" }).click(),
	]);
	await Promise.all([
		page.waitForURL(/\/admin\/catalog\/categories\/new$/, { timeout: 20_000 }),
		page.getByRole("link", { name: "New category" }).click(),
	]);
	await page.locator('[name="name"]').fill(name);
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
	await expect(page.getByText(categoryName)).toBeVisible();
	await expect(page.getByText("Items count").first()).toBeVisible();
	await expect(page.getByText("In use")).toBeVisible();
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
	await page.getByRole("button", { name: "Delete" }).click();
	await page
		.getByRole("alertdialog")
		.getByRole("button", { name: "Delete" })
		.click();

	await expect(page).toHaveURL(/\/admin\/catalog\/categories$/);
	await expect(page.getByRole("link", { name })).toHaveCount(0);
});

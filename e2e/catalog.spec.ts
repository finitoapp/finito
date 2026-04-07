import { expect, test } from "./fixtures";
import categoriesLocale from "@/locales/en/categories";
import commonLocale from "@/locales/en/common";
import componentsLocale from "@/locales/en/components";
import itemsLocale from "@/locales/en/items";
import posLocale from "@/locales/en/pos";

const createUniqueLabel = (prefix: string) =>
	`${prefix} ${Date.now()} ${Math.round(Math.random() * 10_000)}`;

const itemFormLabels = itemsLocale.form["item-form"].label;
const itemDetailFields = itemsLocale.detail.fields;
const itemDetailTabs = itemsLocale.detail.tabs;
const itemDetailHistory = itemsLocale.detail.history;
const itemDetailAnalytics = itemsLocale.detail.analytics;
const itemDetailActions = itemsLocale.detail.actions;
const itemTableActions = itemsLocale.table.actions;
const categoryFormLabels = categoriesLocale.form["category-form"].label;
const categoryDetailActions = categoriesLocale.detail.actions;
const categoryDetailValues = categoriesLocale.detail.values;
const categoryTableActions = categoriesLocale.table.actions;
const autoFormActions = componentsLocale.autoForm.actions;
const dataTableLabels = componentsLocale.dataTable;
const commonTable = commonLocale.table;
const posBill = posLocale.bill;
const posItems = posLocale.items;
const posTabs = posLocale.tabs;
const itemLabelFilterPlaceholder = dataTableLabels.filterPlaceholder.replace(
	"{{title}}",
	itemsLocale.table.columns.label,
);

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

	await expect(page).toHaveURL(
		new RegExp(`/admin/catalog/detail\\?id=${seed.item.id}`),
	);
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
		page
			.getByRole("button", { name: categoriesLocale.table.categories })
			.click(),
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

test("navigates through catalog item detail sections", async ({
	page,
	harness,
}) => {
	const label = createUniqueLabel("Catalog sections");
	const seed = await harness.seedCatalog({
		name: "single-item",
		item: {
			label,
		},
	});
	if (!seed.item) {
		throw new Error("Expected a seeded item for the detail sections scenario.");
	}

	await page.goto(`/admin/catalog/detail?id=${seed.item.id}`);
	await expect(page.getByRole("heading", { name: label })).toBeVisible();

	await Promise.all([
		page.waitForURL(
			new RegExp(`/admin/catalog/detail/inventory\\?id=${seed.item.id}`),
			{ timeout: 20_000 },
		),
		page.getByRole("button", { name: itemDetailTabs.inventory }).click(),
	]);
	await expect(page.getByText("Sklad položky")).toBeVisible();

	await Promise.all([
		page.waitForURL(
			new RegExp(`/admin/catalog/detail/history\\?id=${seed.item.id}`),
			{ timeout: 20_000 },
		),
		page.getByRole("button", { name: itemDetailTabs.history }).click(),
	]);
	await expect(page.getByText(itemDetailHistory.title)).toBeVisible();

	await Promise.all([
		page.waitForURL(
			new RegExp(`/admin/catalog/detail/analytics\\?id=${seed.item.id}`),
			{ timeout: 20_000 },
		),
		page.getByRole("button", { name: itemDetailTabs.analytics }).click(),
	]);
	await expect(page.getByText(itemDetailAnalytics.cards.orders)).toBeVisible();
	await expect(page.getByText(itemDetailAnalytics.empty.title)).toBeVisible();
});

test("updates a catalog item from the edit page", async ({
	page,
	harness,
}) => {
	const initialLabel = createUniqueLabel("Catalog edit before");
	const updatedLabel = createUniqueLabel("Catalog edit after");
	const seed = await harness.seedCatalog({
		name: "single-item",
		item: {
			label: initialLabel,
		},
	});
	if (!seed.item) {
		throw new Error("Expected a seeded item for the edit scenario.");
	}

	await page.goto(`/admin/catalog/detail?id=${seed.item.id}`);
	await expect(page.getByRole("heading", { name: initialLabel })).toBeVisible();

	await page.goto(`/admin/catalog/edit?id=${seed.item.id}`);
	await expect(
		page.getByText(itemsLocale.page.editItem, { exact: true }),
	).toBeVisible();

	await page.getByLabel(itemFormLabels.label).fill(updatedLabel);
	await page.getByLabel(itemFormLabels.price).fill("456");
	await page.getByRole("button", { name: autoFormActions.save }).click();

	await expect(page).toHaveURL(
		new RegExp(`/admin/catalog/detail\\?id=${seed.item.id}`),
		{ timeout: 20_000 },
	);
	await expect(page.getByRole("heading", { name: updatedLabel })).toBeVisible();

	await page.goto("/admin/catalog");
	await expect(page.getByRole("link", { name: updatedLabel })).toBeVisible();
	await expect(page.getByRole("link", { name: initialLabel })).toHaveCount(0);
});

test("filters catalog items by label on the list page", async ({
	page,
	harness,
}) => {
	const seededLabel = createUniqueLabel("Catalog filter seeded");
	const createdLabel = createUniqueLabel("Catalog filter created");

	await harness.seedCatalog({
		name: "single-item",
		item: {
			label: seededLabel,
		},
	});

	await page.goto("/admin/catalog");
	await expect(page.getByRole("link", { name: seededLabel })).toBeVisible();

	await Promise.all([
		page.waitForURL(/\/admin\/catalog\/new$/, { timeout: 20_000 }),
		page.getByRole("link", { name: itemTableActions["new-item"] }).click(),
	]);
	await page.getByLabel(itemFormLabels.label).fill(createdLabel);
	await page.getByLabel(itemFormLabels.price).fill("789");
	await page.getByRole("button", { name: autoFormActions.save }).click();

	await expect(page).toHaveURL(/\/admin\/catalog$/, { timeout: 20_000 });
	await expect(page.getByRole("link", { name: createdLabel })).toBeVisible();

	const filterInput = page.getByPlaceholder(itemLabelFilterPlaceholder);
	await filterInput.fill(createdLabel);

	await expect(page.getByRole("link", { name: createdLabel })).toBeVisible();
	await expect(page.getByRole("link", { name: seededLabel })).toHaveCount(0);
});

test("renames a catalog category from the detail page header", async ({
	page,
	harness,
}) => {
	const initialName = createUniqueLabel("Catalog category rename before");
	const updatedName = createUniqueLabel("Catalog category rename after");
	const seed = await harness.seedCatalog({
		name: "single-category",
		category: {
			name: initialName,
		},
	});
	if (!seed.category) {
		throw new Error("Expected a seeded category for the rename scenario.");
	}

	await page.goto(`/admin/catalog/categories/detail?id=${seed.category.id}`);
	await expect(page.getByTestId("catalog-category-detail-name")).toContainText(
		initialName,
	);

	await page
		.getByTestId("catalog-category-detail-name")
		.getByRole("button")
		.first()
		.click();
	const renameInput = page.getByRole("textbox").first();
	await renameInput.fill(updatedName);
	await renameInput.press("Enter");

	await expect(page.getByTestId("catalog-category-detail-name")).toContainText(
		updatedName,
	);

	await page.goto("/admin/catalog/categories");
	await expect(page.getByRole("link", { name: updatedName })).toBeVisible();
	await expect(page.getByRole("link", { name: initialName })).toHaveCount(0);
});

test("adds a seeded catalog item to a POS bill", async ({
	page,
	harness,
}) => {
	const label = createUniqueLabel("POS catalog item");

	await harness.seedCatalog({
		name: "single-item",
		item: {
			label,
		},
	});

	await page.goto("/admin/pos");
	await expect(
		page.getByRole("button", { name: posTabs.newBill }),
	).toBeVisible();
	await expect(page.getByPlaceholder(posItems.searchItems)).toBeVisible();
	await expect(page.getByText(posBill.noItemsInCart)).toBeVisible();

	await page.getByText(label, { exact: true }).click();

	await expect(page).toHaveURL(/\/admin\/pos\?id=/, { timeout: 20_000 });
	await expect(page.getByText(posBill.noItemsInCart)).toHaveCount(0);
	await expect(page.getByRole("button", { name: posBill.pay })).toBeEnabled();
	await expect(page.getByText(label, { exact: true })).toHaveCount(2);
});

test("switches POS item selector between list and dial modes", async ({
	page,
	harness,
}) => {
	const label = createUniqueLabel("POS dial item");

	await harness.seedCatalog({
		name: "single-item",
		item: {
			label,
		},
	});

	await page.goto("/admin/pos");
	await expect(page.getByPlaceholder(posItems.searchItems)).toBeVisible();
	await expect(page.getByText(label, { exact: true })).toBeVisible();

	await Promise.all([
		page.waitForURL(/\/admin\/pos\?variant=dial$/, { timeout: 20_000 }),
		page.getByRole("tab", { name: posItems.tabs.dial }).click(),
	]);
	await expect(
		page.getByRole("button", { name: "1", exact: true }),
	).toBeVisible();
	await page.getByRole("button", { name: "1", exact: true }).click();
	await page.getByRole("button", { name: "2", exact: true }).click();
	await page.getByRole("button", { name: "3", exact: true }).click();
	await expect(page.getByText("123", { exact: true }).first()).toBeVisible();

	await Promise.all([
		page.waitForURL(/\/admin\/pos$/, { timeout: 20_000 }),
		page.getByRole("tab", { name: posItems.tabs.list }).click(),
	]);
	await expect(page.getByPlaceholder(posItems.searchItems)).toBeVisible();
	await expect(page.getByText(label, { exact: true })).toBeVisible();
});

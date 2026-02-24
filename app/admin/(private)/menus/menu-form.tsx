"use client";

import {
	createId,
	createRandomBytes,
	getOrThrow,
	type Id,
	sqliteTrue,
} from "@evolu/common";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useCreateQuery } from "@/hooks/use-create-query";
import { useEvolu } from "@/hooks/use-evolu";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { useNostr } from "@/hooks/use-nostr";
import { MenuStatus } from "@/lib/evolu/model/menu";
import { publishRelevantMenusToStorage } from "@/lib/menu/service";
import {
	fromDatetimeLocalInputValue,
	toDatetimeLocalInputValue,
} from "@/lib/menu/utils";
import { Currency, NonEmptyStringSchema } from "@/lib/shared/types";
import { formatAmount } from "@/lib/shared/utils/format";

type MenuItemState = {
	id: string;
	sourceItemId: string | null;
	label: string;
	availabilityStatus: "soldOut" | "hidden" | null;
	priceValue: number;
	priceCurrency: string;
	unitOfMeasure: string | null;
	internalCode: string | null;
	productCodeType: string | null;
	productCodeValue: string | null;
};

type MenuCategoryState = {
	id: string;
	name: string;
	selectedItemId: string;
	items: MenuItemState[];
};

type MenuFormState = {
	id?: string;
	name: string;
	status: string;
	validFrom: string;
	validTo: string;
	publishedAt: string;
	categories: MenuCategoryState[];
};

export type MenuFormDefaultValues = {
	id?: string;
	name?: string;
	status?: string;
	validFrom?: number | null;
	validTo?: number | null;
	publishedAt?: number | null;
	categories?: Array<{
		id: string;
		name: string;
		items: MenuItemState[];
	}>;
};

const EmptySelectValue = "__empty__";
const AvailableAvailabilityStatusSelectValue = "__available__";

const menuStatusValues = [MenuStatus.Draft, MenuStatus.Published] as const;
const menuItemAvailabilityStatusValues = ["soldOut", "hidden"] as const;

const menuPayloadSchema = z
	.object({
		id: z.string().trim().min(1).optional(),
		name: NonEmptyStringSchema,
		status: z.enum(menuStatusValues),
		validFrom: z.number().int().nonnegative().nullable(),
		validTo: z.number().int().nonnegative().nullable(),
		publishedAt: z.number().int().nonnegative().nullable(),
		categories: z
			.array(
				z.object({
					id: z.string().trim().min(1),
					name: NonEmptyStringSchema,
					items: z
						.array(
							z.object({
								id: z.string().trim().min(1),
								sourceItemId: z.string().trim().min(1).nullable(),
								label: NonEmptyStringSchema,
								availabilityStatus: z
									.enum(menuItemAvailabilityStatusValues)
									.nullable(),
								priceValue: z.number().int().nonnegative(),
								priceCurrency: z.enum(Currency),
								unitOfMeasure: z.string().trim().min(1).nullable(),
								internalCode: z.string().trim().min(1).nullable(),
								productCodeType: z.string().trim().min(1).nullable(),
								productCodeValue: z.string().trim().min(1).nullable(),
							}),
						)
						.min(1),
				}),
			)
			.min(1),
	})
	.refine(
		(value) =>
			value.validFrom === null ||
			value.validTo === null ||
			value.validFrom <= value.validTo,
		{
			path: ["validTo"],
			message: "validFrom must be before or equal validTo.",
		},
	);

const createNewId = (): Id =>
	createId({ randomBytes: createRandomBytes() }) as Id;

const normalizeNullableString = (value: string | null) => {
	if (value === null) return null;
	const trimmed = value.trim();
	return trimmed.length === 0 ? null : trimmed;
};

const createInitialFormState = (
	defaultValues?: MenuFormDefaultValues,
): MenuFormState => {
	return {
		id: defaultValues?.id,
		name: defaultValues?.name ?? "",
		status: defaultValues?.status ?? MenuStatus.Draft,
		validFrom: toDatetimeLocalInputValue(defaultValues?.validFrom ?? null),
		validTo: toDatetimeLocalInputValue(defaultValues?.validTo ?? null),
		publishedAt: toDatetimeLocalInputValue(defaultValues?.publishedAt ?? null),
		categories:
			defaultValues?.categories?.map((category) => ({
				id: category.id,
				name: category.name,
				selectedItemId: EmptySelectValue,
				items: category.items.map((item) => ({
					...item,
					availabilityStatus: item.availabilityStatus ?? null,
				})),
			})) ?? [],
	};
};

export const MenuForm = (params: {
	defaultValues?: MenuFormDefaultValues;
	onSuccess?: (newId: Id) => unknown;
}) => {
	const { t } = useTranslation();
	const evolu = useEvolu();
	const { ndk } = useNostr();
	const [state, setState] = useState<MenuFormState>(() =>
		createInitialFormState(params.defaultValues),
	);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);

	const itemCatalogQuery = useCreateQuery(
		(db) =>
			db
				.selectFrom("item")
				.select([
					"item.id as id",
					"item.label as label",
					"item.priceValue as priceValue",
					"item.priceCurrency as priceCurrency",
					"item.unitOfMeasure as unitOfMeasure",
					"item.internalCode as internalCode",
					"item.productCodeType as productCodeType",
					"item.productCodeValue as productCodeValue",
				] as const)
				.where("item.isDeleted", "is not", sqliteTrue)
				.orderBy("item.label", "asc"),
		[],
	);
	const { data: itemCatalogRows } = useEvoluQuery(itemCatalogQuery);

	const itemCatalog = useMemo(() => itemCatalogRows ?? [], [itemCatalogRows]);

	const updateCategory = (
		categoryId: string,
		callback: (category: MenuCategoryState) => MenuCategoryState,
	) => {
		setState((previous) => ({
			...previous,
			categories: previous.categories.map((category) =>
				category.id === categoryId ? callback(category) : category,
			),
		}));
	};

	const addCategory = () => {
		setState((previous) => ({
			...previous,
			categories: [
				...previous.categories,
				{
					id: createNewId() as string,
					name: "",
					selectedItemId: EmptySelectValue,
					items: [],
				},
			],
		}));
	};

	const removeCategory = (categoryId: string) => {
		setState((previous) => ({
			...previous,
			categories: previous.categories.filter(
				(category) => category.id !== categoryId,
			),
		}));
	};

	const addItemToCategory = (categoryId: string) => {
		const category = state.categories.find((it) => it.id === categoryId);
		if (!category) return;
		if (
			category.selectedItemId === EmptySelectValue ||
			category.selectedItemId.length === 0
		) {
			return;
		}

		const sourceItem = itemCatalog.find(
			(item) => item.id === category.selectedItemId,
		);
		if (!sourceItem) return;

		updateCategory(categoryId, (current) => {
			if (
				current.items.some(
					(item) => item.sourceItemId === current.selectedItemId,
				)
			) {
				return current;
			}

			const nextItems = [
				...current.items,
				{
					id: createNewId() as string,
					sourceItemId: sourceItem.id,
					label: sourceItem.label,
					availabilityStatus: null,
					priceValue: sourceItem.priceValue,
					priceCurrency: sourceItem.priceCurrency,
					unitOfMeasure: sourceItem.unitOfMeasure,
					internalCode: sourceItem.internalCode,
					productCodeType: sourceItem.productCodeType,
					productCodeValue: sourceItem.productCodeValue,
				} satisfies MenuItemState,
			].sort((a, b) =>
				a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
			);

			return {
				...current,
				selectedItemId: EmptySelectValue,
				items: nextItems,
			};
		});
	};

	const removeItemFromCategory = (categoryId: string, itemId: string) => {
		updateCategory(categoryId, (current) => ({
			...current,
			items: current.items.filter((item) => item.id !== itemId),
		}));
	};

	const syncMenuRelations = async (params: {
		menuId: Id;
		categories: z.infer<typeof menuPayloadSchema>["categories"];
	}) => {
		const { menuId, categories } = params;
		const existingCategories = await evolu.loadQuery(
			evolu.createQuery((db) =>
				db
					.selectFrom("menuCategory")
					.select(["menuCategory.id as id"] as const)
					.where("menuCategory.isDeleted", "is not", sqliteTrue)
					.where("menuCategory.menuId", "=", menuId),
			),
		);
		const existingItems = await evolu.loadQuery(
			evolu.createQuery((db) =>
				db
					.selectFrom("menuItem")
					.innerJoin(
						"menuCategory",
						"menuCategory.id",
						"menuItem.menuCategoryId",
					)
					.select(["menuItem.id as id"] as const)
					.where("menuItem.isDeleted", "is not", sqliteTrue)
					.where("menuCategory.isDeleted", "is not", sqliteTrue)
					.where("menuCategory.menuId", "=", menuId),
			),
		);

		const nextCategoryIds = new Set<string>();
		const nextItemIds = new Set<string>();

		for (const category of categories) {
			nextCategoryIds.add(category.id);
			getOrThrow(
				evolu.upsert("menuCategory", {
					id: category.id as Id,
					menuId,
					name: category.name,
				}),
			);

			for (const item of category.items) {
				nextItemIds.add(item.id);
				getOrThrow(
					evolu.upsert("menuItem", {
						id: item.id as Id,
						menuCategoryId: category.id as Id,
						sourceItemId: item.sourceItemId as Id | null,
						label: item.label,
						availabilityStatus: item.availabilityStatus,
						priceValue: item.priceValue,
						priceCurrency: item.priceCurrency,
						unitOfMeasure: item.unitOfMeasure,
						internalCode: item.internalCode,
						productCodeType: item.productCodeType,
						productCodeValue: item.productCodeValue,
					}),
				);
			}
		}

		for (const { id } of existingItems) {
			if (!nextItemIds.has(id)) {
				getOrThrow(
					evolu.update("menuItem", {
						id: id as Id,
						isDeleted: sqliteTrue,
					}),
				);
			}
		}

		for (const { id } of existingCategories) {
			if (!nextCategoryIds.has(id)) {
				getOrThrow(
					evolu.update("menuCategory", {
						id: id as Id,
						isDeleted: sqliteTrue,
					}),
				);
			}
		}
	};

	const onSave = async () => {
		setSubmitError(null);

		const validFrom = fromDatetimeLocalInputValue(state.validFrom);
		const validTo = fromDatetimeLocalInputValue(state.validTo);
		const publishedAt = fromDatetimeLocalInputValue(state.publishedAt);
		if (state.validFrom.trim() && validFrom === null) {
			setSubmitError("Invalid validFrom datetime value.");
			return;
		}
		if (state.validTo.trim() && validTo === null) {
			setSubmitError("Invalid validTo datetime value.");
			return;
		}
		if (state.publishedAt.trim() && publishedAt === null) {
			setSubmitError("Invalid publishedAt datetime value.");
			return;
		}

		const menuPayloadResult = menuPayloadSchema.safeParse({
			id: state.id,
			name: state.name.trim(),
			status: state.status,
			validFrom,
			validTo,
			publishedAt,
			categories: state.categories.map((category) => ({
				id: category.id,
				name: category.name.trim(),
				items: category.items.map((item) => ({
					id: item.id,
					sourceItemId: item.sourceItemId,
					label: item.label.trim(),
					availabilityStatus: item.availabilityStatus,
					priceValue: item.priceValue,
					priceCurrency: item.priceCurrency,
					unitOfMeasure: normalizeNullableString(item.unitOfMeasure),
					internalCode: normalizeNullableString(item.internalCode),
					productCodeType: normalizeNullableString(item.productCodeType),
					productCodeValue: normalizeNullableString(item.productCodeValue),
				})),
			})),
		});

		if (!menuPayloadResult.success) {
			const firstIssue = menuPayloadResult.error.issues[0];
			setSubmitError(firstIssue?.message ?? "Invalid form values.");
			return;
		}

		setIsSaving(true);
		try {
			const payload = menuPayloadResult.data;
			const menuId = (payload.id ?? createNewId()) as Id;
			getOrThrow(
				evolu.upsert("menu", {
					id: menuId,
					name: payload.name,
					status: payload.status,
					validFrom: payload.validFrom,
					validTo: payload.validTo,
					publishedAt: payload.publishedAt,
				}),
			);
			await syncMenuRelations({
				menuId,
				categories: payload.categories,
			});
			const publishResult = await publishRelevantMenusToStorage({
				ndk,
				evolu,
			});
			if (publishResult instanceof Error) {
				console.error(
					"Failed to publish menus to Nostr storage",
					publishResult,
				);
				toast("Nepodařilo se publikovat menu do veřejného náhledu.");
			}
			params.onSuccess?.(menuId);
		} catch (error) {
			setSubmitError(
				error instanceof Error ? error.message : "Saving menu failed.",
			);
		} finally {
			setIsSaving(false);
		}
	};

	const statusLabels: Record<(typeof menuStatusValues)[number], string> = {
		[MenuStatus.Draft]: t("menus:status.draft"),
		[MenuStatus.Published]: t("menus:status.published"),
	};
	const availabilityStatusLabels: Record<
		(typeof menuItemAvailabilityStatusValues)[number],
		string
	> = {
		soldOut: t("menus:form.availabilityStatus.soldOut"),
		hidden: t("menus:form.availabilityStatus.hidden"),
	};

	return (
		<div className={"space-y-6"}>
			<div className={"grid gap-4 md:grid-cols-2"}>
				<div className={"space-y-2"}>
					<Label>{t("menus:form.fields.name")}</Label>
					<Input
						value={state.name}
						onChange={(event) =>
							setState((previous) => ({
								...previous,
								name: event.target.value,
							}))
						}
					/>
				</div>
				<div className={"space-y-2"}>
					<Label>{t("menus:form.fields.status")}</Label>
					<Select
						value={state.status}
						onValueChange={(value) =>
							setState((previous) => ({ ...previous, status: value }))
						}
					>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{menuStatusValues.map((status) => (
								<SelectItem key={status} value={status}>
									{statusLabels[status]}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className={"space-y-2"}>
					<Label>{t("menus:form.fields.validFrom")}</Label>
					<Input
						type="datetime-local"
						value={state.validFrom}
						onChange={(event) =>
							setState((previous) => ({
								...previous,
								validFrom: event.target.value,
							}))
						}
					/>
				</div>
				<div className={"space-y-2"}>
					<Label>{t("menus:form.fields.validTo")}</Label>
					<Input
						type="datetime-local"
						value={state.validTo}
						onChange={(event) =>
							setState((previous) => ({
								...previous,
								validTo: event.target.value,
							}))
						}
					/>
				</div>
				<div className={"space-y-2 md:col-span-2"}>
					<Label>{t("menus:form.fields.publishedAt")}</Label>
					<Input
						type="datetime-local"
						value={state.publishedAt}
						onChange={(event) =>
							setState((previous) => ({
								...previous,
								publishedAt: event.target.value,
							}))
						}
					/>
				</div>
			</div>

			<div className={"space-y-4"}>
				<div className={"flex items-center justify-between gap-4"}>
					<Label className={"text-base"}>
						{t("menus:form.sections.categories")}
					</Label>
					<Button variant={"outline"} type="button" onClick={addCategory}>
						<PlusIcon />
						{t("menus:form.actions.addCategory")}
					</Button>
				</div>

				<div className={"space-y-4"}>
					{state.categories.map((category) => (
						<div
							key={category.id}
							className={"rounded-lg border p-4 space-y-4 bg-card"}
						>
							<div className={"flex flex-wrap items-end gap-3"}>
								<div className={"space-y-2 flex-1 min-w-64"}>
									<Label>{t("menus:form.sections.categories")}</Label>
									<Input
										placeholder={t("menus:form.placeholder.categoryName")}
										value={category.name}
										onChange={(event) =>
											updateCategory(category.id, (current) => ({
												...current,
												name: event.target.value,
											}))
										}
									/>
								</div>
								<Button
									type="button"
									variant={"outline"}
									onClick={() => removeCategory(category.id)}
								>
									<Trash2Icon />
								</Button>
							</div>

							<div className={"space-y-2"}>
								<Label>{t("menus:form.sections.items")}</Label>
								<div className={"flex flex-wrap items-end gap-3"}>
									<div className={"flex-1 min-w-64"}>
										<Select
											value={category.selectedItemId}
											onValueChange={(value) =>
												updateCategory(category.id, (current) => ({
													...current,
													selectedItemId: value,
												}))
											}
										>
											<SelectTrigger>
												<SelectValue
													placeholder={t("menus:form.placeholder.selectItem")}
												/>
											</SelectTrigger>
											<SelectContent>
												<SelectItem value={EmptySelectValue}>
													{t("menus:form.placeholder.selectItem")}
												</SelectItem>
												{itemCatalog.map((item) => (
													<SelectItem key={item.id} value={item.id}>
														{item.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
									<Button
										type="button"
										variant={"outline"}
										onClick={() => addItemToCategory(category.id)}
									>
										<PlusIcon />
										{t("menus:form.actions.addItem")}
									</Button>
								</div>
							</div>

							<div className={"space-y-2"}>
								{category.items.length === 0 && (
									<div className={"text-sm text-muted-foreground"}>
										{t("menus:common.none")}
									</div>
								)}
								{category.items.map((item) => (
									<div
										key={item.id}
										className={
											"rounded-md border px-3 py-2 flex items-center gap-3 justify-between"
										}
									>
										<div className={"flex flex-col gap-1"}>
											<div className={"font-medium"}>{item.label}</div>
											<div className={"text-sm text-muted-foreground"}>
												{formatAmount(
													item.priceValue,
													item.priceCurrency as (typeof Currency)[keyof typeof Currency],
												)}
												{item.unitOfMeasure ? ` / ${item.unitOfMeasure}` : ""}
											</div>
										</div>
										<div className={"flex items-center gap-2"}>
											<div className={"w-40"}>
												<Select
													value={
														item.availabilityStatus ??
														AvailableAvailabilityStatusSelectValue
													}
													onValueChange={(value) =>
														updateCategory(category.id, (current) => ({
															...current,
															items: current.items.map((currentItem) =>
																currentItem.id !== item.id
																	? currentItem
																	: {
																			...currentItem,
																			availabilityStatus:
																				value ===
																				AvailableAvailabilityStatusSelectValue
																					? null
																					: (value as (typeof menuItemAvailabilityStatusValues)[number]),
																		},
															),
														}))
													}
												>
													<SelectTrigger>
														<SelectValue
															placeholder={t(
																"menus:form.fields.availabilityStatus",
															)}
														/>
													</SelectTrigger>
													<SelectContent>
														<SelectItem
															value={AvailableAvailabilityStatusSelectValue}
														>
															{t("menus:form.availabilityStatus.available")}
														</SelectItem>
														{menuItemAvailabilityStatusValues.map((status) => (
															<SelectItem key={status} value={status}>
																{availabilityStatusLabels[status]}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</div>
											<Button
												type="button"
												variant={"outline"}
												onClick={() =>
													removeItemFromCategory(category.id, item.id)
												}
											>
												<Trash2Icon />
											</Button>
										</div>
									</div>
								))}
							</div>
						</div>
					))}
				</div>
			</div>

			{submitError && (
				<div className={"text-sm text-destructive"}>{submitError}</div>
			)}

			<div className={"flex justify-end"}>
				<Button type="button" onClick={() => void onSave()} disabled={isSaving}>
					{t("menus:form.actions.save")}
				</Button>
			</div>
		</div>
	);
};

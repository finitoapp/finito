"use client";

import {
	createId,
	createRandomBytes,
	evoluJsonArrayFrom,
	evoluJsonObjectFrom,
	type Id,
	type KyselyNotNull,
	sqliteTrue,
} from "@evolu/common";
import { usePDF } from "@react-pdf/renderer";
import { useMutation } from "@tanstack/react-query";
import {
	CopyIcon,
	EditIcon,
	ExternalLink,
	EyeIcon,
	PrinterIcon,
	QrCodeIcon,
	Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { BackButton } from "@/components/back-button";
import { KeyValueList } from "@/components/key-value-list";
import { type MenuPdfData, MenuPdfTemplate } from "@/components/menus/menu-pdf";
import { ResponsiveCard } from "@/components/responsive-card";
import { StaticCard } from "@/components/static-card";
import { Button } from "@/components/ui/button";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useEvolu } from "@/hooks/use-evolu";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { useGlobalDialog } from "@/hooks/use-global-dialog";
import { useNostr } from "@/hooks/use-nostr";
import { createQuery } from "@/lib/evolu";
import { MenuStatus } from "@/lib/evolu/model/menu";
import { publishRelevantMenusToStorage } from "@/lib/menu/service";
import { isMenuVisibleForPublic } from "@/lib/menu/utils";
import { downloadFile } from "@/lib/shared/files/file-utils";
import { NonEmptyString255 } from "@/lib/shared/types";
import { formatAmount } from "@/lib/shared/utils/format";
import { clientBaseUrl } from "@/lib/shared/utils/window";

const createNewId = () => createId({ randomBytes: createRandomBytes() });

const getStatusLabel = (t: (key: string) => string, value: string) => {
	if (value === MenuStatus.Draft) return t("menus:status.draft");
	if (value === MenuStatus.Published) return t("menus:status.published");
	return value;
};

const formatNullableDate = (
	value: number | null | undefined,
	fallback: string,
) =>
	value === null || value === undefined
		? fallback
		: new Date(value).toLocaleString();

const toSafeFileName = (value: string) => {
	const normalized = value
		.toLocaleLowerCase()
		.normalize("NFKD")
		.replaceAll(/[\u0300-\u036f]/g, "")
		.replaceAll(/[^a-z0-9]+/g, "-")
		.replaceAll(/^-+|-+$/g, "");
	return normalized.length > 0 ? normalized : "menu";
};

const RawMenuPdfGenerator = (props: {
	fileName: string;
	menuPdfData: MenuPdfData;
	onGenerated: (params: {
		bytes: BlobPart[];
		mimetype: string;
		fileName: string;
	}) => void;
}) => {
	const { fileName, menuPdfData, onGenerated } = props;
	const [instance] = usePDF({
		document: <MenuPdfTemplate menu={menuPdfData} />,
	});
	const hasGeneratedRef = useRef(false);

	useEffect(() => {
		if (instance.blob === null || hasGeneratedRef.current) {
			return;
		}
		hasGeneratedRef.current = true;

		onGenerated({
			bytes: [instance.blob],
			mimetype: "application/pdf",
			fileName,
		});
	}, [instance.blob, fileName, onGenerated]);

	return null;
};

const DownloadMenuPdf = (props: {
	fileName: string;
	menuPdfData: MenuPdfData;
}) => {
	const { t } = useTranslation();
	const [isGenerating, setGenerating] = useState(false);

	return (
		<Button
			variant={"outline"}
			className={"w-full"}
			disabled={isGenerating}
			onClick={() => setGenerating(true)}
		>
			<PrinterIcon />
			{isGenerating
				? t("menus:detail.actions.downloadingPdf")
				: t("menus:detail.actions.downloadPdf")}
			{isGenerating && (
				<RawMenuPdfGenerator
					fileName={props.fileName}
					menuPdfData={props.menuPdfData}
					onGenerated={async (params) => {
						try {
							await downloadFile(params);
						} finally {
							setGenerating(false);
						}
					}}
				/>
			)}
		</Button>
	);
};

export default function Home() {
	const { t, i18n } = useTranslation();
	const evolu = useEvolu();
	const { ndk } = useNostr();
	const { withConfirm } = useGlobalDialog();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	const router = useRouter();
	if (id === null) {
		throw Promise.reject();
	}

	const menuQuery = useMemo(
		() =>
			createQuery((db) =>
				db
					.selectFrom("menu")
					.select(
						(eb) =>
							[
								"menu.id as id",
								"menu.name as name",
								"menu.status as status",
								"menu.validFrom as validFrom",
								"menu.validTo as validTo",
								"menu.publishedAt as publishedAt",

								evoluJsonArrayFrom(
									eb
										.selectFrom("menuCategory")
										.select((eb) => [
											"menuCategory.id as id",
											"menuCategory.menuId as menuId",
											"menuCategory.name as name",

											evoluJsonArrayFrom(
												eb
													.selectFrom("menuItemLine")
													.select(
														(eb) =>
															[
																"menuItemLine.id as id",
																"menuItemLine.availabilityStatus as availabilityStatus",

																evoluJsonObjectFrom(
																	eb
																		.selectFrom("menuItem")
																		.select([
																			"menuItem.id as id",
																			"menuItem.categoryId as categoryId",
																			"menuItem.sourceItemId as sourceItemId",
																			"menuItem.label as label",
																			"menuItem.price as price",
																			"menuItem.currency as currency",
																			"menuItem.unitOfMeasure as unitOfMeasure",
																			"menuItem.internalCode as internalCode",
																			"menuItem.productCodeType as productCodeType",
																			"menuItem.productCodeValue as productCodeValue",
																		])
																		.whereRef(
																			"menuItem.id",
																			"=",
																			"menuItemLine.id",
																		)
																		.where(
																			"menuItem.isDeleted",
																			"is not",
																			sqliteTrue,
																		)
																		.where("menuItem.label", "is not", null)
																		.where("menuItem.price", "is not", null)
																		.where("menuItem.currency", "is not", null)
																		.$narrowType<{
																			label: KyselyNotNull;
																			price: KyselyNotNull;
																			currency: KyselyNotNull;
																		}>(),
																).as("item"),
															] as const,
													)
													.whereRef(
														"menuItemLine.menuCategoryId",
														"=",
														"menuCategory.id",
													)
													.where("menuItemLine.isDeleted", "is not", sqliteTrue)
													.$narrowType<{
														item: KyselyNotNull;
													}>(),
											).as("items"),
										])
										.whereRef("menuCategory.menuId", "=", "menu.id")
										.where("menuCategory.isDeleted", "is not", sqliteTrue)
										.where("menuCategory.name", "is not", null)
										.where("menuCategory.menuId", "=", id as Id)
										.$narrowType<{
											name: KyselyNotNull;
										}>(),
								).as("categories"),
							] as const,
					)
					.where("menu.isDeleted", "is not", sqliteTrue)
					.where("menu.name", "is not", null)
					.where("menu.status", "is not", null)
					.where("menu.id", "=", id as Id)
					.$narrowType<{
						name: KyselyNotNull;
						status: KyselyNotNull;
					}>(),
			),
		[id],
	);

	const { data: menus } = useEvoluQuery(menuQuery);

	const menu = menus[0];
	const isVisible = isMenuVisibleForPublic({
		status: menu?.status ?? null,
		publishedAt: menu?.publishedAt ?? null,
	});

	const menuPdfData = useMemo<MenuPdfData | null>(() => {
		if (!menu) return null;
		const validityPrefix = t("menus:pdf.validity");
		const validFromDate = menu.validFrom
			? new Date(menu.validFrom).toLocaleDateString(i18n.language)
			: null;
		const validToDate = menu.validTo
			? new Date(menu.validTo).toLocaleDateString(i18n.language)
			: null;
		const validityLabel =
			validFromDate && validToDate
				? `${validityPrefix}: ${validFromDate} - ${validToDate}`
				: validFromDate
					? `${validityPrefix}: ${validFromDate}`
					: validToDate
						? `${validityPrefix}: ${validToDate}`
						: null;

		return {
			name: menu.name,
			validityLabel,
			emptyLabel: t("menus:common.none"),
			categoriesLabel: t("menus:form.sections.categories"),
			categories: menu.categories.map((category) => ({
				id: category.id,
				name: category.name,
				items: category.items.map((item) => ({
					id: item.id,
					label: item.item.label,
					amountLabel: `${formatAmount(item.item.price, item.item.currency)}${item.item.unitOfMeasure ? ` / ${item.item.unitOfMeasure}` : ""}`,
				})),
			})),
		};
	}, [menu, t, i18n.language]);
	const menuPdfFileName = useMemo(
		() => `menu-${toSafeFileName(menu?.name ?? "menu")}.pdf`,
		[menu?.name],
	);
	const menuPreviewUrl = `${clientBaseUrl}#m-${ndk.signer.pubkey}`;

	const { mutateAsync: deleteMenu } = useMutation({
		mutationFn: async () => {
			if (!menu) return;

			evolu.update("menu", {
				id: menu.id,
				isDeleted: sqliteTrue,
			});
			for (const category of menu.categories ?? []) {
				evolu.update("menuCategory", {
					id: category.id,
					isDeleted: sqliteTrue,
				});

				for (const item of category.items) {
					evolu.update("menuItemLine", {
						id: item.id,
						isDeleted: sqliteTrue,
					});
					evolu.update("menuItem", {
						id: item.id,
						isDeleted: sqliteTrue,
					});
				}
			}

			router.push("/admin/menus" as never);
		},
	});

	const { mutateAsync: toggleMenuStatus } = useMutation({
		mutationFn: async () => {
			if (!menu) return;

			const nextStatus =
				menu.status === MenuStatus.Published
					? MenuStatus.Draft
					: MenuStatus.Published;
			const nextPublishedAt =
				nextStatus === MenuStatus.Published ? Date.now() : menu.publishedAt;
			evolu.update("menu", {
				id: menu.id,
				status: nextStatus,
				publishedAt: nextPublishedAt,
			});

			const publishResult = await publishRelevantMenusToStorage({
				ndk,
				evolu,
			});
			if (!publishResult.ok) {
				console.error(
					"Failed to publish menus to Nostr storage",
					publishResult.error,
				);
				toast("Nepodařilo se publikovat menu do veřejného náhledu.");
			}
		},
	});

	const { mutateAsync: duplicateMenu } = useMutation({
		mutationFn: async () => {
			if (!menu) return;

			const newMenuId = createNewId();
			evolu.upsert("menu", {
				id: newMenuId,
				name: NonEmptyString255(`Kopie - ${menu.name}`),
				status: MenuStatus.Draft,
				validFrom: menu.validFrom,
				validTo: menu.validTo,
				publishedAt: null,
			});

			const categoryIdMap = new Map<string, Id>();
			for (const category of menu.categories) {
				const newCategoryId = createNewId();
				categoryIdMap.set(category.id, newCategoryId);
				evolu.upsert("menuCategory", {
					id: newCategoryId,
					menuId: newMenuId,
					name: category.name,
				});

				for (const item of category.items) {
					const itemId = createNewId();
					evolu.upsert("menuItemLine", {
						id: itemId,
						menuCategoryId: newCategoryId,
						availabilityStatus: item.availabilityStatus,
					});
					evolu.upsert("menuItem", {
						id: itemId,
						sourceItemId: item.item.sourceItemId,
						label: item.item.label,
						price: item.item.price,
						currency: item.item.currency,
						unitOfMeasure: item.item.unitOfMeasure,
						internalCode: item.item.internalCode,
						productCodeType: item.item.productCodeType,
						productCodeValue: item.item.productCodeValue,
					});
				}
			}

			router.push(
				`/admin/menus/edit?id=${encodeURIComponent(newMenuId)}` as never,
			);
		},
	});

	const onDelete = withConfirm(
		async () => {
			await deleteMenu();
		},
		{
			title: "Delete menu?",
			description: "This action cannot be undone.",
			confirmText: "Delete",
			cancelText: "Cancel",
			confirmVariant: "destructive",
		},
	);

	useEffect(() => {
		if (menu === undefined) {
			router.replace("/admin/menus");
		}
	}, [menu, router]);

	if (menu === undefined) {
		return null;
	}

	const itemsCount = menu.categories.reduce((acc, category) => {
		return acc + category.items.length;
	}, 0);

	return (
		<div className={"w-full lg:max-w-7xl"}>
			<div className={"mb-6"}>
				<BackButton />
			</div>

			<div className={"flex gap-4 flex-wrap"}>
				<ResponsiveCard className={"flex-2"}>
					<CardHeader>
						<CardTitle>
							{!menu && <Skeleton />}
							{menu?.name}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className={"flex flex-col gap-8"}>
							<div className={"flex gap-4 flex-wrap"}>
								<StaticCard
									title={t("menus:detail.stats.categories")}
									content={menu.categories.length.toString()}
									className={"flex-1 min-w-40"}
								/>
								<StaticCard
									title={t("menus:detail.stats.items")}
									content={
										<>
											{!menu && <Skeleton />}
											{menu && itemsCount.toString()}
										</>
									}
									className={"flex-1 min-w-40"}
								/>
								<StaticCard
									title={t("menus:detail.stats.visibility")}
									content={
										<>
											{!menu && <Skeleton />}
											{menu &&
												(isVisible
													? t("menus:common.yes")
													: t("menus:common.no"))}
										</>
									}
									className={"flex-1 min-w-40"}
								/>
							</div>

							<div className={"flex flex-wrap gap-8"}>
								<div className={"flex-1 min-w-72"}>
									<KeyValueList
										items={[
											{
												key: t("menus:table.columns.name"),
												value: menu?.name ?? t("menus:common.none"),
											},
											{
												key: t("menus:table.columns.status"),
												value: menu
													? getStatusLabel(t, menu.status)
													: t("menus:common.none"),
											},
											{
												key: t("menus:form.fields.validFrom"),
												value: formatNullableDate(
													menu?.validFrom,
													t("menus:common.none"),
												),
											},
											{
												key: t("menus:form.fields.validTo"),
												value: formatNullableDate(
													menu?.validTo,
													t("menus:common.none"),
												),
											},
											{
												key: t("menus:table.columns.publishedAt"),
												value: formatNullableDate(
													menu?.publishedAt,
													t("menus:common.always"),
												),
											},
										]}
									/>
								</div>
								<div className={"flex-1 min-w-72 space-y-3"}>
									<div className={"font-medium"}>
										{t("menus:form.sections.categories")}
									</div>
									{menu.categories.length === 0 && (
										<div className={"text-sm text-muted-foreground"}>
											{t("menus:common.none")}
										</div>
									)}
									{menu.categories.map((category) => (
										<div
											key={category.id}
											className={"rounded-md border p-3 space-y-1"}
										>
											<div className={"font-medium"}>{category.name}</div>
											<div className={"text-sm text-muted-foreground"}>
												{category.items.length > 0
													? category.items
															.map((item) => item.item.label)
															.join(", ")
													: t("menus:common.none")}
											</div>
										</div>
									))}
								</div>
							</div>
						</div>
					</CardContent>
				</ResponsiveCard>

				<div className={"flex-1 flex flex-col gap-4 min-w-72"}>
					<ResponsiveCard>
						<CardHeader>
							<CardTitle>{t("common:table.actions")}</CardTitle>
						</CardHeader>
						<CardContent className={"space-y-2"}>
							{menuPdfData && (
								<DownloadMenuPdf
									fileName={menuPdfFileName}
									menuPdfData={menuPdfData}
								/>
							)}
							<Button
								variant={"outline"}
								className={"w-full"}
								render={
									<Link
										href={
											`/admin/menus/edit?id=${encodeURIComponent(id)}` as never
										}
									/>
								}
							>
								<EditIcon />
								{t("menus:detail.actions.edit")}
							</Button>
							<Button
								variant={"outline"}
								className={"w-full"}
								onClick={() => void toggleMenuStatus()}
							>
								<EyeIcon />
								{menu?.status === MenuStatus.Published
									? t("menus:detail.actions.moveToDraft")
									: t("menus:detail.actions.publish")}
							</Button>
							<Button
								variant={"outline"}
								className={"w-full"}
								render={
									<a href={menuPreviewUrl} target={"_blank"} rel={"noreferrer"}>
										<ExternalLink />
										Náhled
									</a>
								}
							></Button>
							<Dialog>
								<DialogTrigger
									render={<Button variant={"outline"} className={"w-full"} />}
								>
									<QrCodeIcon />
									Zobraz QR kód
								</DialogTrigger>
								<DialogContent>
									<DialogHeader>
										<DialogTitle>Zobraz QR kód</DialogTitle>
									</DialogHeader>
									<div className={"py-4 bg-white flex rounded"}>
										<QRCodeSVG
											className={"w-full"}
											size={256}
											value={menuPreviewUrl}
										/>
									</div>
								</DialogContent>
							</Dialog>
							<Button
								variant={"outline"}
								className={"w-full"}
								onClick={() => void duplicateMenu()}
							>
								<CopyIcon />
								{t("menus:detail.actions.duplicate")}
							</Button>
							<Button className={"w-full"} onClick={() => void onDelete()}>
								<Trash2Icon />
								{t("menus:detail.actions.delete")}
							</Button>
						</CardContent>
					</ResponsiveCard>
				</div>
			</div>
		</div>
	);
}

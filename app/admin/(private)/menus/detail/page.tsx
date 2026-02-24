"use client";

import {
	createId,
	createRandomBytes,
	getOrThrow,
	type Id,
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
import { useCreateQuery } from "@/hooks/use-create-query";
import { useEvolu } from "@/hooks/use-evolu";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { useGlobalDialog } from "@/hooks/use-global-dialog";
import { useNostr } from "@/hooks/use-nostr";
import { MenuStatus } from "@/lib/evolu/model/menu";
import { publishRelevantMenusToStorage } from "@/lib/menu/service";
import { isMenuVisibleForPublic } from "@/lib/menu/utils";
import { downloadFile } from "@/lib/shared/files/file-utils";
import { formatAmount } from "@/lib/shared/utils/format";
import { clientBaseUrl } from "@/lib/shared/utils/window";

const createNewId = () => createId({ randomBytes: createRandomBytes() }) as Id;

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

	const menuQuery = useCreateQuery(
		(db) =>
			db
				.selectFrom("menu")
				.select([
					"menu.id as id",
					"menu.name as name",
					"menu.status as status",
					"menu.validFrom as validFrom",
					"menu.validTo as validTo",
					"menu.publishedAt as publishedAt",
					"menu.createdAt as createdAt",
				] as const)
				.where("menu.isDeleted", "is not", sqliteTrue)
				.where("menu.id", "=", id as Id),
		[id],
	);
	const categoriesQuery = useCreateQuery(
		(db) =>
			db
				.selectFrom("menuCategory")
				.select([
					"menuCategory.id as id",
					"menuCategory.menuId as menuId",
					"menuCategory.name as name",
				] as const)
				.where("menuCategory.isDeleted", "is not", sqliteTrue)
				.where("menuCategory.menuId", "=", id as Id),
		[id],
	);
	const itemsQuery = useCreateQuery(
		(db) =>
			db
				.selectFrom("menuItem")
				.innerJoin("menuCategory", "menuCategory.id", "menuItem.menuCategoryId")
				.select([
					"menuItem.id as id",
					"menuItem.menuCategoryId as menuCategoryId",
					"menuItem.sourceItemId as sourceItemId",
					"menuItem.label as label",
					"menuItem.availabilityStatus as availabilityStatus",
					"menuItem.priceValue as priceValue",
					"menuItem.priceCurrency as priceCurrency",
					"menuItem.unitOfMeasure as unitOfMeasure",
					"menuItem.internalCode as internalCode",
					"menuItem.productCodeType as productCodeType",
					"menuItem.productCodeValue as productCodeValue",
				] as const)
				.where("menuItem.isDeleted", "is not", sqliteTrue)
				.where("menuCategory.isDeleted", "is not", sqliteTrue)
				.where("menuCategory.menuId", "=", id as Id),
		[id],
	);

	const { data: menus } = useEvoluQuery(menuQuery);
	const { data: categoriesRows } = useEvoluQuery(categoriesQuery);
	const { data: itemsRows } = useEvoluQuery(itemsQuery);

	const menu = menus?.[0];
	const categoriesCount = categoriesRows?.length ?? 0;
	const itemsCount = itemsRows?.length ?? 0;
	const isVisible = isMenuVisibleForPublic({
		status: menu?.status ?? null,
		publishedAt: menu?.publishedAt ?? null,
	});

	const groupedCategories = useMemo(() => {
		const categoryMap = new Map<
			string,
			{
				id: string;
				name: string;
				items: Array<{
					id: string;
					label: string;
					priceValue: number;
					priceCurrency: string;
					unitOfMeasure: string | null;
				}>;
			}
		>();
		for (const category of categoriesRows ?? []) {
			if (category.name === null) continue;

			categoryMap.set(category.id, {
				id: category.id,
				name: category.name,
				items: [],
			});
		}
		for (const item of itemsRows ?? []) {
			if (
				item.label === null ||
				item.priceValue === null ||
				item.priceCurrency === null
			) {
				continue;
			}

			const category = categoryMap.get(item.menuCategoryId);
			if (!category) continue;
			category.items.push({
				id: item.id,
				label: item.label,
				priceValue: item.priceValue,
				priceCurrency: item.priceCurrency,
				unitOfMeasure: item.unitOfMeasure,
			});
		}

		return [...categoryMap.values()]
			.map((category) => ({
				...category,
				items: [...category.items].sort((a, b) =>
					a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
				),
			}))
			.sort((a, b) =>
				a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
			);
	}, [categoriesRows, itemsRows]);

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
			categories: groupedCategories.map((category) => ({
				id: category.id,
				name: category.name,
				items: category.items.map((item) => ({
					id: item.id,
					label: item.label,
					amountLabel: `${formatAmount(item.priceValue, item.priceCurrency)}${item.unitOfMeasure ? ` / ${item.unitOfMeasure}` : ""}`,
				})),
			})),
		};
	}, [menu, t, i18n.language, groupedCategories]);
	const menuPdfFileName = useMemo(
		() => `menu-${toSafeFileName(menu?.name ?? "menu")}.pdf`,
		[menu?.name],
	);
	const menuPreviewUrl = `${clientBaseUrl}#m-${ndk.signer.pubkey}`;

	const { mutateAsync: deleteMenu } = useMutation({
		mutationFn: async () => {
			if (!menu) return;

			getOrThrow(
				evolu.update("menu", {
					id: menu.id,
					isDeleted: sqliteTrue,
				}),
			);
			for (const category of categoriesRows ?? []) {
				getOrThrow(
					evolu.update("menuCategory", {
						id: category.id as Id,
						isDeleted: sqliteTrue,
					}),
				);
			}
			for (const item of itemsRows ?? []) {
				getOrThrow(
					evolu.update("menuItem", {
						id: item.id as Id,
						isDeleted: sqliteTrue,
					}),
				);
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
			getOrThrow(
				evolu.update("menu", {
					id: menu.id,
					status: nextStatus,
					publishedAt: nextPublishedAt,
				}),
			);

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
		},
	});

	const { mutateAsync: duplicateMenu } = useMutation({
		mutationFn: async () => {
			if (!menu) return;

			const newMenuId = createNewId();
			getOrThrow(
				evolu.upsert("menu", {
					id: newMenuId,
					name: `Kopie - ${menu.name}`,
					status: MenuStatus.Draft,
					validFrom: menu.validFrom,
					validTo: menu.validTo,
					publishedAt: null,
				}),
			);

			const categoryIdMap = new Map<string, Id>();
			for (const category of categoriesRows ?? []) {
				const newCategoryId = createNewId();
				categoryIdMap.set(category.id, newCategoryId);
				getOrThrow(
					evolu.upsert("menuCategory", {
						id: newCategoryId,
						menuId: newMenuId,
						name: category.name,
					}),
				);
			}

			for (const item of itemsRows ?? []) {
				const newCategoryId = categoryIdMap.get(item.menuCategoryId);
				if (!newCategoryId) continue;

				getOrThrow(
					evolu.upsert("menuItem", {
						id: createNewId(),
						menuCategoryId: newCategoryId,
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
									content={
										<>
											{!menu && <Skeleton />}
											{menu && categoriesCount.toString()}
										</>
									}
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
									{groupedCategories.length === 0 && (
										<div className={"text-sm text-muted-foreground"}>
											{t("menus:common.none")}
										</div>
									)}
									{groupedCategories.map((category) => (
										<div
											key={category.id}
											className={"rounded-md border p-3 space-y-1"}
										>
											<div className={"font-medium"}>{category.name}</div>
											<div className={"text-sm text-muted-foreground"}>
												{category.items.length > 0
													? category.items.map((item) => item.label).join(", ")
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
							<Button variant={"outline"} className={"w-full"} asChild>
								<Link
									href={
										`/admin/menus/edit?id=${encodeURIComponent(id)}` as never
									}
								>
									<EditIcon />
									{t("menus:detail.actions.edit")}
								</Link>
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
							<Button variant={"outline"} className={"w-full"} asChild>
								<a href={menuPreviewUrl} target={"_blank"} rel={"noreferrer"}>
									<ExternalLink />
									Náhled
								</a>
							</Button>
							<Dialog>
								<DialogTrigger asChild>
									<Button variant={"outline"} className={"w-full"}>
										<QrCodeIcon />
										Zobraz QR kód
									</Button>
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

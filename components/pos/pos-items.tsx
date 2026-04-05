import { motion } from "framer-motion";
import { useAtomValue } from "jotai";
import { PackageOpenIcon, PlusCircleIcon, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import type React from "react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { accountAtom } from "@/atoms/account";
import { PosDial } from "@/components/pos/pos-dial";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBill } from "@/hooks/use-bill";
import { useEvolu } from "@/hooks/use-evolu";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import type { Pos } from "@/hooks/use-pos";
import { getAllCatalogItemsQuery } from "@/lib/evolu/queries/catalog-item";
import { activeCategoriesQuery } from "@/lib/evolu/queries/category";
import type { Id } from "@/lib/evolu/types";
import { convertCatalogItemToItem, createItem } from "@/lib/item/service";
import {
	type Currency,
	NonEmptyString255,
	NumberString,
} from "@/lib/shared/types";
import { formatMoney } from "@/lib/shared/utils/format";
import { moneyCodec } from "@/lib/shared/zod/money-codec";

export const PosItems: React.FC<{
	billId?: Id;
	bill?: Pos["bills"][Id];
	onItemClick?: (event: React.MouseEvent<HTMLDivElement>) => unknown;
	defaultCurrency: Currency;
}> = (props) => {
	const { t } = useTranslation();
	const router = useRouter();
	const evolu = useEvolu();
	const searchParams = useSearchParams();
	const variant = searchParams.get("variant") ?? "list";
	const id = searchParams.get("id") ?? "";
	const { addItem } = useBill();
	const account = useAtomValue(accountAtom);

	return (
		<Tabs value={variant} className="flex w-full flex-col gap-4">
			<TabsList className="w-full">
				<TabsTrigger
					value="list"
					onClick={() =>
						router.replace(
							`/admin/pos?${id ? `id=${encodeURIComponent(id)}` : ""}`,
						)
					}
				>
					{t("pos:items.tabs.list")}
				</TabsTrigger>
				<TabsTrigger
					value="dial"
					onClick={() =>
						router.replace(
							`/admin/pos?${id ? `id=${encodeURIComponent(id)}&` : ""}variant=${encodeURIComponent("dial")}`,
						)
					}
				>
					{t("pos:items.tabs.dial")}
				</TabsTrigger>
			</TabsList>
			<TabsContent value="list">
				<PosItemsList {...props} />
			</TabsContent>
			<TabsContent value="dial">
				<div className={"flex justify-center max-w-md flex-col mx-auto"}>
					<Card>
						<CardContent>
							<PosDial
								onSubmit={async (value) => {
									const item = await createItem({ evolu })({
										item: {
											deviceId: account.device.id,
											catalogItemId: null,
											label: NonEmptyString255(t("pos:items.unknownItem")),
											price: moneyCodec.decode({
												value: NumberString(value.toString()),
												currency: props.defaultCurrency,
											}).value,
											currency: props.defaultCurrency,
											categoryId: null,
											unitOfMeasure: null,
											internalCode: null,
											productCodeType: null,
											productCodeValue: null,
										},
									});
									const billId = await addItem({
										billId: props.billId,
										defaultCurrency: props.defaultCurrency,
										item: item,
										quantity: 1,
									});

									if (billId !== undefined) {
										router.replace(
											`/admin/pos?id=${encodeURIComponent(billId)}&variant=${encodeURIComponent("dial")}`,
										);
									}
								}}
							/>
						</CardContent>
					</Card>
				</div>
			</TabsContent>
		</Tabs>
	);
};

export const PosItemsList: React.FC<{
	billId?: Id;
	bill?: Pos["bills"][Id];
	onItemClick?: (event: React.MouseEvent<HTMLDivElement>) => unknown;
	defaultCurrency: Currency;
}> = (props) => {
	const { t } = useTranslation();
	const router = useRouter();
	const [searchTerm, setSearchTerm] = useState("");
	const { addItem } = useBill();

	const { data: items } = useEvoluQuery(getAllCatalogItemsQuery);
	const { data: categories } = useEvoluQuery(activeCategoriesQuery);

	const categoriesById = useMemo(
		() => new Map(categories.map((category) => [category.id, category])),
		[categories],
	);

	const filteredItems = useMemo(
		() =>
			(items ?? [])
				.filter((item) => {
					return item.label.toLowerCase().includes(searchTerm.toLowerCase());
				})
				.map(convertCatalogItemToItem),
		[items, searchTerm],
	);
	const groupedItems = useMemo(() => {
		const map = new Map<string, typeof filteredItems>();

		for (const item of filteredItems) {
			const category =
				item.categoryId !== null ? categoriesById.get(item.categoryId) : null;

			const key = category?.name ?? t("pos:items.uncategorized");
			const previous = map.get(key);
			if (previous) {
				previous.push(item);
			} else {
				map.set(key, [item]);
			}
		}

		return Array.from(map.entries())
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([categoryName, items]) => ({
				categoryName,
				items: [...items].sort((a, b) => a.label.localeCompare(b.label)),
			}));
	}, [filteredItems, t, categoriesById]);

	return (
		<div className="flex w-full flex-col gap-4">
			<div className="w-full">
				{/* Search and Categories */}
				<div className="relative">
					<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
					<Input
						placeholder={t("pos:items.searchItems")}
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className="pl-10"
					/>
				</div>
			</div>

			<div className="flex flex-col gap-8">
				{groupedItems.map((category) => (
					<div key={category.categoryName} className="flex flex-col gap-3">
						<h3 className="text-sm font-semibold text-muted-foreground">
							{category.categoryName}
						</h3>
						<div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
							{category.items.map((item) => (
								<Card
									key={item.id}
									className="cursor-pointer hover:shadow-md transition-shadow"
									onClick={async (event) => {
										if (props.onItemClick) {
											props.onItemClick(event);
										}

										const billId = await addItem({
											billId: props.billId,
											defaultCurrency: props.defaultCurrency,
											item,
											quantity: 1,
										});

										if (billId !== undefined) {
											router.replace(
												`/admin/pos?id=${encodeURIComponent(billId)}`,
											);
										}
									}}
								>
									<motion.div
										whileTap={{
											scale: 1.1,
											opacity: 0.5,
										}}
										initial={{ scale: 1.1, opacity: 0.5 }}
										animate={{ scale: 1, opacity: 1 }}
									>
										<CardContent className="p-4 text-center">
											<PackageOpenIcon
												className={
													"w-16 h-16 mx-auto mb-2 rounded-lg object-cover"
												}
											/>
											<h3 className="font-medium text-sm mb-1 text-balance">
												{item.label}
											</h3>
											<p className="text-lg font-bold text-primary">
												{formatMoney({
													value: item.price,
													currency: item.currency,
												})}
											</p>
										</CardContent>
									</motion.div>
								</Card>
							))}
						</div>
					</div>
				))}
				<div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
					<Card
						className="cursor-pointer hover:shadow-md transition-shadow"
						onClick={() => router.push("/admin/catalog/new")}
					>
						<CardContent className="p-4 text-center">
							<PlusCircleIcon
								className={"w-16 h-16 mx-auto mb-2 rounded-lg object-cover"}
							/>
							<h3 className="font-medium text-sm mb-1 text-balance">
								{t("pos:items.newProduct")}
							</h3>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
};

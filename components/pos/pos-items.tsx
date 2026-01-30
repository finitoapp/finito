import { sqliteTrue } from "@evolu/common";
import { motion } from "framer-motion";
import { PackageOpenIcon, PlusCircleIcon, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import type React from "react";
import { useMemo, useState } from "react";
import type { Pos } from "@/atoms/pos";
import { PosDial } from "@/components/pos/pos-dial";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBill } from "@/hooks/use-bill";
import { useCreateQuery } from "@/hooks/use-create-query";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { formatAmount } from "@/lib/format-utils";
import { nestObjectSkipNullBranches } from "@/lib/object-utils";
import { type Currency, NonEmptyString, Uuid7 } from "@/lib/types";

export const PosItems: React.FC<{
	billId?: Uuid7;
	bill?: Pos["bills"][string];
	onItemClick?: (event: React.MouseEvent<HTMLDivElement>) => unknown;
	defaultCurrency: Currency;
}> = (props) => {
	const router = useRouter();
	const searchParams = useSearchParams();
	const variant = searchParams.get("variant") ?? "list";
	const id = searchParams.get("id") ?? "";
	const { addItem } = useBill();

	return (
		<Tabs value={variant} className="flex w-full flex-col gap-4">
			<TabsList className="grid w-full grid-cols-2" variant={"line"}>
				<TabsTrigger
					value="list"
					onClick={() =>
						router.replace(`/admin/pos?id=${encodeURIComponent(id)}`)
					}
				>
					Item list
				</TabsTrigger>
				<TabsTrigger
					value="dial"
					onClick={() =>
						router.replace(
							`/admin/pos?id=${encodeURIComponent(id)}&variant=${encodeURIComponent("dial")}`,
						)
					}
				>
					Dial
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
								onSubmit={(value) => {
									addItem({
										billId: props.billId ?? Uuid7.random(),
										defaultCurrency: props.defaultCurrency,
										item: {
											id: Uuid7.random(),
											label: NonEmptyString("Unknown"),
											price: {
												currency: props.defaultCurrency,
												value,
											},
										},
									});
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
	billId?: Uuid7;
	bill?: Pos["bills"][string];
	onItemClick?: (event: React.MouseEvent<HTMLDivElement>) => unknown;
	defaultCurrency: Currency;
}> = (props) => {
	const router = useRouter();
	const [searchTerm, setSearchTerm] = useState("");
	const { addItem } = useBill();

	const query = useCreateQuery(
		(db) =>
			db
				.selectFrom("item")
				.leftJoin("category", "category.id", "item.categoryId")
				.select([
					"item.id as id",
					"item.label as label",
					"item.priceValue as price.value",
					"item.priceCurrency as price.currency",
					"category.id as category.id",
					"category.name as category.name",
				] as const)
				.where("item.isDeleted", "is not", sqliteTrue),
		[],
	);
	const items = useEvoluQuery(query).data.map(nestObjectSkipNullBranches);

	const filteredItems = useMemo(
		() =>
			(items ?? []).filter((item) => {
				return item.label.toLowerCase().includes(searchTerm.toLowerCase());
			}),
		[items, searchTerm],
	);
	const groupedItems = useMemo(() => {
		const map = new Map<string, typeof filteredItems>();

		for (const item of filteredItems) {
			const key = item.category?.name ?? "Uncategorized";
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
	}, [filteredItems]);

	return (
		<div className="flex w-full flex-col gap-4">
			<div className="w-full">
				{/* Search and Categories */}
				<div className="relative">
					<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
					<Input
						placeholder="Search items..."
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
									onClick={(event) => {
										if (props.onItemClick) {
											props.onItemClick(event);
										}

										addItem({
											billId: props.billId ?? Uuid7.random(),
											defaultCurrency: props.defaultCurrency,
											item,
										});
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
												{formatAmount(item.price.value, item.price.currency)}
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
						onClick={() => router.push("/admin/items/new")}
						variant={"accent"}
					>
						<CardContent className="p-4 text-center">
							<PlusCircleIcon
								className={"w-16 h-16 mx-auto mb-2 rounded-lg object-cover"}
							/>
							<h3 className="font-medium text-sm mb-1 text-balance">
								New product
							</h3>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
};

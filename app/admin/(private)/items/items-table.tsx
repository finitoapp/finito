"use client";

import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataGrid } from "@/components/data-grid";
import { ResponsiveCard } from "@/components/responsive-card";
import { Button } from "@/components/ui/button";
import {
	CardContent,
	CardDescription,
	CardHeader,
	CardHeading,
	CardTitle,
	CardToolbar,
} from "@/components/ui/card";
import { useStorageSubscription } from "@/hooks/use-storage-subscription";
import { formatAmount } from "@/lib/format-utils";
import { itemStorage } from "@/storages/item-storage";

export function ItemsTable() {
	const router = useRouter();
	const {
		data: items,
		hasNextPage,
		loadNextPage,
		eose,
	} = useStorageSubscription(itemStorage, {
		limit: 15,
	});

	return (
		<ResponsiveCard>
			<CardHeader>
				<CardHeading className={"py-6"}>
					<CardTitle>Items</CardTitle>
					<CardDescription>List of your sales items</CardDescription>
				</CardHeading>
				<CardToolbar>
					<Link href={"/admin/items/new"}>
						<Button>
							<PlusIcon />
							New item
						</Button>
					</Link>
				</CardToolbar>
			</CardHeader>
			<CardContent className={"p-0"}>
				<DataGrid
					data={
						items
							? items.map((item) => ({
									id: item.value.id,
									eventId: item.eventId,
									createdAt: new Date(item.createdAt * 1000),
									amount: formatAmount(
										item.value.price.value,
										item.value.price.currency,
									),
									label: item.value.label,
								}))
							: undefined
					}
					columns={[
						{
							key: "label" as const,
							header: "Label",
							width: "400px",
						},
						{
							key: "amount" as const,
							header: "Amount",
						},
					]}
					onRowClick={(item) =>
						router.push(`/admin/items/detail?id=${encodeURIComponent(item.id)}`)
					}
					className="border rounded-md"
				/>

				{hasNextPage && (
					<div className={"flex my-4 justify-center"}>
						<Button
							disabled={!eose}
							variant={"outline"}
							size={"sm"}
							onClick={loadNextPage}
						>
							Load next page
						</Button>
					</div>
				)}
			</CardContent>
		</ResponsiveCard>
	);
}

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
import { tableStorage } from "@/storages/table-storage";

export function TablesTable() {
	const router = useRouter();
	const {
		data: items,
		hasNextPage,
		loadNextPage,
		eose,
	} = useStorageSubscription(tableStorage, {
		limit: 15,
	});

	return (
		<ResponsiveCard>
			<CardHeader>
				<CardHeading className={"py-6"}>
					<CardTitle>Tables</CardTitle>
					<CardDescription>List of your tables</CardDescription>
				</CardHeading>
				<CardToolbar>
					<Link href={"/admin/tables/new"}>
						<Button>
							<PlusIcon />
							New table
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
									label: item.value.label,
									numberOfSeats: item.value.numberOfSeats,
									qrCodes: (item.value.qrCodes ?? [])
										.map((qrCode) => qrCode.id)
										.join(", "),
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
							key: "numberOfSeats" as const,
							header: "Number of Seats",
						},
						{
							key: "qrCodes" as const,
							header: "QR Codes",
						},
					]}
					onRowClick={(item) =>
						router.push(
							`/admin/tables/detail?id=${encodeURIComponent(item.id)}`,
						)
					}
					className="border rounded-md"
				/>

				{hasNextPage && (
					<div className={"flex mt-y justify-center"}>
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

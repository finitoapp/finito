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
import { clientStorage } from "@/storages/client-storage";

export function ClientTable() {
	const router = useRouter();
	const {
		data: items,
		hasNextPage,
		loadNextPage,
		eose,
	} = useStorageSubscription(clientStorage, {
		limit: 15,
	});

	return (
		<ResponsiveCard>
			<CardHeader>
				<CardHeading className={"py-6"}>
					<CardTitle>Clients</CardTitle>
					<CardDescription>List of your clients</CardDescription>
				</CardHeading>
				<CardToolbar>
					<Link href={"/admin/clients/new"}>
						<Button>
							<PlusIcon />
							New client
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
									label: item.value.label,
									name: item.value.name,
									vatNumber: item.value.countrySpecific.vatNumber,
								}))
							: undefined
					}
					columns={[
						{
							key: "label" as const,
							header: "Label",
							width: "400px",
							render: (_item, row) => row.label ?? row.name,
						},
						{
							key: "vatNumber" as const,
							header: "VAT Number",
						},
					]}
					onRowClick={(item) =>
						router.push(
							`/admin/clients/detail?id=${encodeURIComponent(item.id)}`,
						)
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

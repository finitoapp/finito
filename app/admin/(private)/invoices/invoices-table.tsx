"use client";

import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { InvoiceStatusBadge } from "@/app/admin/(private)/invoices/invoice-status-badge";
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
import { invoiceStorage } from "@/storages/invoice-storage";

export function InvoicesTable() {
	const router = useRouter();
	const {
		data: items,
		hasNextPage,
		loadNextPage,
		eose,
	} = useStorageSubscription(invoiceStorage, {
		limit: 15,
	});

	return (
		<ResponsiveCard>
			<CardHeader>
				<CardHeading className={"py-6"}>
					<CardTitle>Invoices</CardTitle>
					<CardDescription>List of your invoices</CardDescription>
				</CardHeading>
				<CardToolbar>
					<Link href={"/admin/invoices/new"}>
						<Button>
							<PlusIcon />
							New invoice
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
									status: item.value.id,
									invoiceNumber: item.value.invoiceNumber,
									customerName: item.value.customer.billingInfo.name,
									issueDate: new Date(
										item.value.issueDate,
									).toLocaleDateString(),
									dueDate: new Date(item.value.dueDate).toLocaleDateString(),
									amount: formatAmount(
										item.value.items.reduce(
											(acc, value) => acc + value.price * value.quantity,
											0,
										),
										item.value.currency,
									),
								}))
							: undefined
					}
					columns={[
						{
							key: "invoiceNumber" as const,
							header: "Invoice number",
							width: "400px",
						},
						{
							key: "customerName" as const,
							header: "Customer name",
						},
						{
							key: "issueDate" as const,
							header: "Issue date",
						},
						{
							key: "dueDate" as const,
							header: "Due date",
						},
						{
							key: "amount" as const,
							header: "Amount",
						},
						{
							key: "status" as const,
							header: "Status",
							render: (_, row) => (
								<InvoiceStatusBadge
									invoiceId={row.id}
									dueDate={new Date(row.dueDate)}
								/>
							),
						},
					]}
					onRowClick={(item) =>
						router.push(
							`/admin/invoices/detail?id=${encodeURIComponent(item.id)}`,
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

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
import { formatIban } from "@/lib/format-utils";
import { accountStorage } from "@/storages/account-storage";

export function AccountsTable() {
	const router = useRouter();
	const {
		data: items,
		hasNextPage,
		loadNextPage,
		eose,
	} = useStorageSubscription(accountStorage, {
		limit: 15,
	});

	return (
		<ResponsiveCard>
			<CardHeader>
				<CardHeading className={"py-6"}>
					<CardTitle>Accounts</CardTitle>
					<CardDescription>
						List of your accounts (bank accounts, wallets, etc.)
					</CardDescription>
				</CardHeading>
				<CardToolbar>
					<Link href={"/admin/accounts/new"}>
						<Button>
							<PlusIcon />
							New account
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
									name: item.value.name,
									type: item.value._tag,
									address: item
										? item.value._tag === "lud16"
											? item.value.lud16
											: item.value._tag === "cash_register"
												? "-"
												: item.value._tag === "spark"
													? "-"
													: formatIban(item.value.iban)
										: "-",
								}))
							: undefined
					}
					columns={[
						{
							key: "name" as const,
							header: "Name",
							width: "400px",
						},
						{
							key: "type" as const,
							header: "Type",
						},
						{
							key: "address" as const,
							header: "Address",
						},
					]}
					onRowClick={(item) =>
						router.push(
							`/admin/accounts/detail?id=${encodeURIComponent(item.id)}`,
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

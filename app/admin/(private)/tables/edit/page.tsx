"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { TableForm } from "@/app/admin/(private)/tables/table-form";
import { BackButton } from "@/components/back-button";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStorageSubscription } from "@/hooks/use-storage-subscription";
import { tableStorage } from "@/storages/table-storage";

export default function Home() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	if (id === null) {
		throw Promise.reject();
	}

	const { data } = useStorageSubscription(tableStorage, {
		key: id,
	});

	const item = data && data[0];

	return (
		<div className={"max-w-xl w-full"}>
			<div className={"mb-6"}>
				<BackButton />
			</div>

			<ResponsiveCard>
				<CardHeader>
					<CardTitle>Edit table</CardTitle>
				</CardHeader>
				<CardContent>
					<TableForm
						key={item ? "yes" : "no"}
						defaultValues={
							item
								? {
										...item.value,
										numberOfSeats: item.value.numberOfSeats.toString(),
									}
								: undefined
						}
						onSuccess={() =>
							router.push(`/admin/tables/detail?id=${encodeURIComponent(id)}`)
						}
					/>
				</CardContent>
			</ResponsiveCard>
		</div>
	);
}

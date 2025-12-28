"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ItemForm } from "@/app/admin/(private)/items/item-form";
import { BackButton } from "@/components/back-button";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStorageSubscription } from "@/hooks/use-storage-subscription";
import { ProductCodeType } from "@/lib/types";
import { itemStorage } from "@/storages/item-storage";

export default function Home() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	if (id === null) {
		throw Promise.reject();
	}

	const { data } = useStorageSubscription(itemStorage, {
		key: id,
	});

	const item = data && data[0];

	return (
		<div className={"w-full lg:max-w-7xl"}>
			<div className={"mb-6"}>
				<BackButton />
			</div>

			<ResponsiveCard>
				<CardHeader>
					<CardTitle>Edit item</CardTitle>
				</CardHeader>
				<CardContent>
					<ItemForm
						key={item ? "yes" : "no"}
						defaultValues={
							item
								? {
										...item.value,
										price: item.value.price.value.toString(),
										currency: item.value.price.currency,
										productCode: item.value.productCode
											? item.value.productCode.code
											: "",
										productCodeType: item.value.productCode
											? item.value.productCode.type
											: ProductCodeType.EAN,
									}
								: undefined
						}
						onSuccess={() =>
							router.push(`/admin/items/detail?id=${encodeURIComponent(id)}`)
						}
					/>
				</CardContent>
			</ResponsiveCard>
		</div>
	);
}

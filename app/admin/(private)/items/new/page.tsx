"use client";

import { useRouter } from "next/navigation";
import { ItemForm } from "@/app/admin/(private)/items/item-form";
import { BackButton } from "@/components/back-button";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStorageSubscription } from "@/hooks/use-storage-subscription";
import { billingSettingsStorage } from "@/storages/billing-settings-storage";

export default function Home() {
	const router = useRouter();

	const { data: billingSettingsRows } = useStorageSubscription(
		billingSettingsStorage,
		{
			limit: 1,
		},
	);

	const billingSettings = billingSettingsRows && billingSettingsRows[0];

	return (
		<div className={"max-w-xl w-full"}>
			<div className={"mb-6"}>
				<BackButton />
			</div>

			<ResponsiveCard>
				<CardHeader>
					<CardTitle>New item</CardTitle>
				</CardHeader>
				<CardContent>
					<ItemForm
						key={[billingSettings ? "true" : false].join(",")}
						onSuccess={() => router.push("/admin/items")}
						defaultValues={{
							currency: billingSettings?.value.defaultCurrency,
						}}
					/>
				</CardContent>
			</ResponsiveCard>
		</div>
	);
}

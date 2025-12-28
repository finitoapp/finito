"use client";

import { POS } from "@/components/pos/pos";
import { useStorageSubscription } from "@/hooks/use-storage-subscription";
import { Currency } from "@/lib/types";
import { billingSettingsStorage } from "@/storages/billing-settings-storage";

export default function Home() {
	const { data: billingSettingsRows } = useStorageSubscription(
		billingSettingsStorage,
		{
			limit: 1,
		},
	);

	const billingSettings = billingSettingsRows && billingSettingsRows[0];

	return (
		<div className={"w-full flex flex-col gap-6"}>
			<POS
				defaultCurrency={billingSettings?.value.defaultCurrency ?? Currency.USD}
			/>
		</div>
	);
}

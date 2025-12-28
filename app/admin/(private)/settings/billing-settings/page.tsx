"use client";

import { BillingSettingsForm } from "@/app/admin/(private)/settings/billing-settings/billing-settings-form";
import { useStorageSubscription } from "@/hooks/use-storage-subscription";
import { billingSettingsStorage } from "@/storages/billing-settings-storage";

export default function Home() {
	const { data } = useStorageSubscription(billingSettingsStorage, {
		limit: 1,
	});

	const item = data && data[0];

	return (
		<div className="w-full max-w-xl">
			<BillingSettingsForm
				key={item ? "yes" : "no"}
				defaultValues={
					item
						? {
								...item.value,
								defaultInvoiceDueDateDays:
									item.value.defaultInvoiceDueDateDays.toFixed(),
								taxRates: item.value.taxRates.map((taxRate) => ({
									...taxRate,
									rate: taxRate.rate.toFixed(),
									name: taxRate.name ?? "",
								})),
								invoiceEmailSettings: item.value.invoiceEmailSettings
									? {
											enable: true,
											...item.value.invoiceEmailSettings,
										}
									: {
											enable: false,
										},
							}
						: undefined
				}
			/>
		</div>
	);
}

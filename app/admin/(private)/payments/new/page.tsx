"use client";

import { PaymentForm } from "@/app/admin/(private)/payments/new/payment-form";
import { BackButton } from "@/components/back-button";
import { useStorageSubscription } from "@/hooks/use-storage-subscription";
import { useNostrProfile } from "@/hooks/useNostrProfile";
import { billingInfoStorage } from "@/storages/billing-info-storage";
import { billingSettingsStorage } from "@/storages/billing-settings-storage";

export default function Home() {
	const nostrProfile = useNostrProfile();

	const { data } = useStorageSubscription(billingInfoStorage, {
		limit: 1,
	});

	const { data: billingSettingsRows } = useStorageSubscription(
		billingSettingsStorage,
		{
			limit: 1,
		},
	);

	const item = data && data[0];
	const billingSettings = billingSettingsRows && billingSettingsRows[0];

	return (
		<div className={"w-full lg:max-w-7xl"}>
			<div className={"mb-6"}>
				<BackButton />
			</div>

			<PaymentForm
				key={[item && billingSettings && nostrProfile ? "true" : false].join(
					",",
				)}
				defaultValues={{
					lud16: nostrProfile?.lud16 ?? "",
					merchantName: item?.value.name ?? "",
					currency: billingSettings?.value.defaultCurrency,
					type: billingSettings?.value.defaultPaymentMethod,
				}}
			/>
		</div>
	);
}

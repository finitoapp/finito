"use client";

import { BillingInfoForm } from "@/app/admin/(private)/settings/billing-info/billing-info-form";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStorageSubscription } from "@/hooks/use-storage-subscription";
import { billingInfoStorage } from "@/storages/billing-info-storage";

export default function Home() {
	const { data } = useStorageSubscription(billingInfoStorage, {
		limit: 1,
	});

	const item = data && data[0];

	return (
		<ResponsiveCard className="w-full max-w-xl">
			<CardHeader>
				<CardTitle>Billing information</CardTitle>
			</CardHeader>
			<CardContent>
				<BillingInfoForm
					key={item ? "yes" : "no"}
					customStorage={billingInfoStorage}
					defaultValues={
						item
							? {
									...item.value,
									countrySpecific: {
										...item.value.countrySpecific,
										vatNumber: item.value.countrySpecific.vatNumber ?? "",
										identificationNumber:
											item.value.countrySpecific.identificationNumber ?? "",
										caseNumber: item.value.countrySpecific.caseNumber ?? "",
									},
								}
							: undefined
					}
				/>
			</CardContent>
		</ResponsiveCard>
	);
}

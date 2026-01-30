"use client";

import { createIdFromString, sqliteTrue } from "@evolu/common";
import { PaymentForm } from "@/app/admin/(private)/payments/new/payment-form";
import { BackButton } from "@/components/back-button";
import { useCreateQuery } from "@/hooks/use-create-query";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { useNostrProfile } from "@/hooks/useNostrProfile";

export default function Home() {
	const nostrProfile = useNostrProfile();

	const billingInfoQuery = useCreateQuery(
		(db) =>
			db
				.selectFrom("billingInfo")
				.selectAll()
				.where("billingInfo.isDeleted", "is not", sqliteTrue)
				.where("billingInfo.id", "=", createIdFromString("")),
		[],
	);
	const { data } = useEvoluQuery(billingInfoQuery);

	const billingSettingsQuery = useCreateQuery(
		(db) =>
			db
				.selectFrom("billingSettings")
				.selectAll()
				.where("billingSettings.isDeleted", "is not", sqliteTrue)
				.where("billingSettings.id", "=", createIdFromString("")),
		[],
	);
	const { data: billingSettingsRows } = useEvoluQuery(billingSettingsQuery);

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
					merchantName: item?.name ?? "",
					currency: billingSettings?.defaultCurrency,
					type: billingSettings?.defaultPaymentMethod,
				}}
			/>
		</div>
	);
}

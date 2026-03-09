"use client";

import {
	createIdFromString,
	type KyselyNotNull,
	sqliteTrue,
} from "@evolu/common";
import { useMemo } from "react";
import { PaymentForm } from "@/app/admin/(private)/payments/new/payment-form";
import { BackButton } from "@/components/back-button";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { createQuery } from "@/lib/evolu";

export default function Home() {
	const billingInfoQuery = useMemo(
		() =>
			createQuery((db) =>
				db
					.selectFrom("billingInfo")
					.select(["billingInfo.name as name"])
					.where("billingInfo.isDeleted", "is not", sqliteTrue)
					.where("billingInfo.name", "is not", null)
					.where("billingInfo.id", "=", createIdFromString(""))
					.$narrowType<{
						name: KyselyNotNull;
					}>(),
			),
		[],
	);
	const { data } = useEvoluQuery(billingInfoQuery);

	const billingSettingsQuery = useMemo(
		() =>
			createQuery((db) =>
				db
					.selectFrom("billingSettings")
					.select([
						"billingSettings.defaultPaymentMethod as defaultPaymentMethod",
						"billingSettings.defaultCurrency as defaultCurrency",
					])
					.where("billingSettings.isDeleted", "is not", sqliteTrue)
					.where("billingSettings.defaultPaymentMethod", "is not", null)
					.where("billingSettings.defaultCurrency", "is not", null)
					.where("billingSettings.id", "=", createIdFromString(""))
					.$narrowType<{
						defaultPaymentMethod: KyselyNotNull;
						defaultCurrency: KyselyNotNull;
					}>(),
			),
		[],
	);
	const { data: billingSettingsRows } = useEvoluQuery(billingSettingsQuery);

	const item = data[0];
	const billingSettings = billingSettingsRows[0];

	return (
		<div className={"w-full lg:max-w-7xl"}>
			<div className={"mb-6"}>
				<BackButton />
			</div>

			<PaymentForm
				defaultValues={{
					merchantName: item?.name ?? "",
					currency: billingSettings?.defaultCurrency,
					type: billingSettings?.defaultPaymentMethod,
				}}
			/>
		</div>
	);
}

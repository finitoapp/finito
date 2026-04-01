"use client";

import {
	createIdFromString,
	evoluJsonArrayFrom,
	type KyselyNotNull,
	sqliteTrue,
} from "@evolu/common";
import { useMemo } from "react";
import { BillingSettingsForm } from "@/app/admin/(private)/settings/billing-settings/billing-settings-form";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { createQuery } from "@/lib/evolu";

export default function Home() {
	const itemId = createIdFromString("");
	const query = useMemo(
		() =>
			createQuery((db) => {
				return db
					.selectFrom("billingSettings")
					.select((eb) => [
						"billingSettings.ownContactId as ownContactId",
						"billingSettings.defaultCurrency as defaultCurrency",
						"billingSettings.defaultTimezone as defaultTimezone",
						"billingSettings.defaultPaymentMethod as defaultPaymentMethod",
						"billingSettings.defaultBankTransferCzKey as defaultBankTransferCzKey",
						"billingSettings.defaultLnZapKey as defaultLnZapKey",
						"billingSettings.defaultLnSparkKey as defaultLnSparkKey",

						evoluJsonArrayFrom(
							eb
								.selectFrom("billingSettingsTaxRate")
								.select(["id", "name", "rate"])
								.where("isDeleted", "is not", sqliteTrue)
								.where("id", "is not", null)
								.where("rate", "is not", null)
								.$narrowType<{
									id: KyselyNotNull;
									rate: KyselyNotNull;
								}>(),
						).as("rates"),
					])
					.where("billingSettings.isDeleted", "is not", sqliteTrue)
					.where("billingSettings.defaultCurrency", "is not", null)
					.where("billingSettings.defaultTimezone", "is not", null)
					.where("billingSettings.defaultPaymentMethod", "is not", null)
					.where("billingSettings.id", "=", itemId)
					.$narrowType<{
						defaultCurrency: KyselyNotNull;
						defaultTimezone: KyselyNotNull;
						defaultPaymentMethod: KyselyNotNull;
					}>();
			}),
		[itemId],
	);

	const { data } = useEvoluQuery(query);

	const item = data[0];

	return (
		<div className="w-full max-w-xl">
			<BillingSettingsForm
				defaultValues={
					item
						? {
								ownContactId: item.ownContactId,
								defaultCurrency: item.defaultCurrency,
								defaultTimezone: item.defaultTimezone,
								defaultPaymentMethod: item.defaultPaymentMethod,
								defaultBankTransferCzKey: item.defaultBankTransferCzKey,
								defaultLnZapKey: item.defaultLnZapKey,
								defaultLnSparkKey: item.defaultLnSparkKey,
								taxRates: item.rates.map((tr) => ({
									id: tr.id,
									name: tr.name ?? "",
									rate: tr.rate.toString(),
								})),
							}
						: undefined
				}
			/>
		</div>
	);
}

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
						"defaultInvoiceDueDateDays",
						"defaultCurrency",
						"defaultTimezone",
						"defaultPaymentMethodMethod",
						"defaultPaymentMethodBankAccountKey",
						"defaultPaymentMethod",
						"defaultBankTransferCzKey",
						"defaultLnZapKey",
						"defaultLnSparkKey",
						"invoiceEmailSettingsEnable",
						"invoiceEmailSettingsSubject",
						"invoiceEmailSettingsBody",

						evoluJsonArrayFrom(
							eb
								.selectFrom("billingSettingsTaxRate")
								.select(["id", "name", "rate"])
								.where("isDeleted", "is not", sqliteTrue)
								.where("rate", "is not", null)
								.$narrowType<{
									rate: KyselyNotNull;
								}>(),
						).as("rates"),
					])
					.where("isDeleted", "is not", sqliteTrue)
					.where("defaultInvoiceDueDateDays", "is not", null)
					.where("defaultCurrency", "is not", null)
					.where("defaultTimezone", "is not", null)
					.where("defaultPaymentMethod", "is not", null)
					.where("invoiceEmailSettingsEnable", "is not", null)
					.where("id", "=", itemId)
					.$narrowType<{
						defaultInvoiceDueDateDays: KyselyNotNull;
						defaultCurrency: KyselyNotNull;
						defaultTimezone: KyselyNotNull;
						defaultPaymentMethod: KyselyNotNull;
						invoiceEmailSettingsEnable: KyselyNotNull;
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
								defaultInvoiceDueDateDays:
									item.defaultInvoiceDueDateDays.toString(),
								defaultCurrency: item.defaultCurrency,
								defaultTimezone: item.defaultTimezone,
								defaultPayment: {
									method: item.defaultPaymentMethodMethod,
									bankAccountKey: item.defaultPaymentMethodBankAccountKey,
								},
								defaultPaymentMethod: item.defaultPaymentMethod,
								defaultBankTransferCzKey: item.defaultBankTransferCzKey,
								defaultLnZapKey: item.defaultLnZapKey,
								defaultLnSparkKey: item.defaultLnSparkKey,
								invoiceEmailSettings: {
									enable: item.invoiceEmailSettingsEnable === sqliteTrue,
									subject: item.invoiceEmailSettingsSubject ?? "",
									body: item.invoiceEmailSettingsBody ?? "",
								},
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

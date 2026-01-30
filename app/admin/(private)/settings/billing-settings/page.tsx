"use client";

import { createIdFromString, sqliteTrue } from "@evolu/common";
import { BillingSettingsForm } from "@/app/admin/(private)/settings/billing-settings/billing-settings-form";
import { useCreateQuery } from "@/hooks/use-create-query";
import { useEvoluQuery } from "@/hooks/use-evolu-query";

export default function Home() {
	const itemId = createIdFromString("");
	const query = useCreateQuery(
		(db) => {
			return db
				.selectFrom("billingSettings")
				.selectAll()
				.where("isDeleted", "is not", sqliteTrue)
				.where("id", "=", itemId);
		},
		[itemId],
	);

	const taxRatesQuery = useCreateQuery(
		(db) => {
			return db
				.selectFrom("billingSettingsTaxRate")
				.selectAll()
				.where("isDeleted", "is not", sqliteTrue)
				.where("billingSettingsId", "=", itemId);
		},
		[itemId],
	);

	const { data } = useEvoluQuery(query);
	const { data: taxRates } = useEvoluQuery(taxRatesQuery);

	const item = data && data[0];

	return (
		<div className="w-full max-w-xl">
			<BillingSettingsForm
				key={item && taxRates !== undefined ? "yes" : "no"}
				defaultValues={
					item && taxRates
						? {
								id: item.id,
								defaultInvoiceDueDateDays: item.defaultInvoiceDueDateDays.toString(),
								defaultCurrency: item.defaultCurrency,
								defaultTimezone: item.defaultTimezone,
								defaultPayment: {
									method: item.defaultPaymentMethodMethod as any,
									bankAccountKey: item.defaultPaymentMethodBankAccountKey,
								},
								defaultPaymentMethod: item.defaultPaymentMethod as any,
								defaultBankTransferCzKey: item.defaultBankTransferCzKey,
								defaultLnZapKey: item.defaultLnZapKey,
								defaultLnSparkKey: item.defaultLnSparkKey,
								invoiceEmailSettings: {
									enable: item.invoiceEmailSettingsEnable === sqliteTrue,
									subject: item.invoiceEmailSettingsSubject ?? "",
									body: item.invoiceEmailSettingsBody ?? "",
								},
								taxRates: taxRates.map((tr) => ({
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

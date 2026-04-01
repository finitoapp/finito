"use client";

import {
	createIdFromString,
	type KyselyNotNull,
	sqliteTrue,
} from "@evolu/common";
import { useMemo } from "react";
import { InvoiceSettingsForm } from "@/app/admin/(private)/invoices/settings/invoice-settings-form";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { createQuery } from "@/lib/evolu";

export default function Home() {
	const itemId = createIdFromString("");

	const invoiceSettingsQuery = useMemo(
		() =>
			createQuery((db) =>
				db
					.selectFrom("invoiceSettings")
					.select(["defaultDueDateDays", "defaultPaymentMethod"])
					.where("isDeleted", "is not", sqliteTrue)
					.where("defaultDueDateDays", "is not", null)
					.where("id", "=", itemId)
					.$narrowType<{
						defaultDueDateDays: KyselyNotNull;
					}>(),
			),
		[itemId],
	);

	const { data: invoiceSettingsData } = useEvoluQuery(invoiceSettingsQuery);

	const invoiceSettings = invoiceSettingsData[0];

	return (
		<div className={"flex flex-col gap-4"}>
			<div className={"w-full max-w-xl"}>
				<InvoiceSettingsForm
					defaultValues={{
						defaultDueDateDays:
							invoiceSettings?.defaultDueDateDays?.toString() ?? "14",
						defaultPaymentMethod: invoiceSettings?.defaultPaymentMethod ?? null,
					}}
				/>
			</div>
		</div>
	);
}

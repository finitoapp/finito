"use client";

import {
	createIdFromString,
	type KyselyNotNull,
	sqliteTrue,
} from "@evolu/common";
import { useMemo } from "react";
import { InvoiceEmailSettingsForm } from "@/app/admin/(private)/invoices/mail-settings/invoice-email-settings-form";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { createQuery } from "@/lib/evolu";

export default function Home() {
	const itemId = createIdFromString("");

	const invoiceEmailSettingsQuery = useMemo(
		() =>
			createQuery((db) =>
				db
					.selectFrom("invoiceEmailSettings")
					.select(["enable", "subject", "body"])
					.where("isDeleted", "is not", sqliteTrue)
					.where("enable", "is not", null)
					.where("id", "=", itemId)
					.$narrowType<{
						enable: KyselyNotNull;
					}>(),
			),
		[itemId],
	);

	const { data: invoiceEmailSettingsData } = useEvoluQuery(
		invoiceEmailSettingsQuery,
	);

	const invoiceEmailSettings = invoiceEmailSettingsData[0];

	return (
		<div className={"flex flex-col gap-4"}>
			<div className={"w-full max-w-xl"}>
				<InvoiceEmailSettingsForm
					defaultValues={{
						invoiceEmailSettings: {
							enable: invoiceEmailSettings?.enable === sqliteTrue,
							subject: invoiceEmailSettings?.subject ?? "",
							body: invoiceEmailSettings?.body ?? "",
						},
					}}
				/>
			</div>
		</div>
	);
}

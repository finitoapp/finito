"use client";

import { useQuery } from "@tanstack/react-query";
import { addDays } from "date-fns";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { InvoiceForm } from "@/app/admin/(private)/invoices/invoice-form";
import { BackButton } from "@/components/back-button";
import { useNostr } from "@/hooks/use-nostr";
import { useStorageSubscription } from "@/hooks/use-storage-subscription";
import { resolveSubsequentInvoiceNumber } from "@/lib/invoice-number-service";
import { accountStorage } from "@/storages/account-storage";
import { billingInfoStorage } from "@/storages/billing-info-storage";
import { billingSettingsStorage } from "@/storages/billing-settings-storage";
import { invoiceLastNumberStorage } from "@/storages/invoice-last-number-storage";

export default function Home() {
	const id = useId();
	const { ndk } = useNostr();
	const router = useRouter();
	const [now] = useState(() => new Date());

	const { data: serialNumber } = useQuery({
		queryKey: [`serialNumber-${id}`],
		queryFn: () => resolveSubsequentInvoiceNumber({ ndk }),
		gcTime: 0,
		staleTime: 0,
	});

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

	const { data: bankAccountRows } = useStorageSubscription(accountStorage, {
		limit: 1,
		key: billingSettings?.value.defaultPayment?.bankAccountKey,
	});

	const bankAccount = bankAccountRows && bankAccountRows[0];

	return (
		<div className={"w-full lg:max-w-7xl"}>
			<div className={"mb-6"}>
				<BackButton />
			</div>

			<InvoiceForm
				key={[
					item ? "true" : false,
					billingSettings ? "true" : false,
					bankAccount ? "true" : false,
					serialNumber ? "true" : false,
				].join(",")}
				onSuccess={async (_, values) => {
					if (values.invoiceNumber === serialNumber?.invoiceNumber) {
						await invoiceLastNumberStorage.insertOrUpdate({ ndk }, null, {
							serialNumber: serialNumber.serialNumber,
							date: serialNumber.date,
						});
					}

					router.push("/admin/invoices");
				}}
				defaultValues={
					item
						? {
								invoiceNumber: serialNumber?.invoiceNumber ?? "",
								supplier: {
									billingInfo: item.value,
								},
								issueDate: now,
								dueDate: addDays(
									now,
									billingSettings?.value.defaultInvoiceDueDateDays ?? 14,
								),
								currency: billingSettings?.value.defaultCurrency,
								payment: {
									method:
										billingSettings?.value.defaultPayment?.method ?? undefined,
									iban:
										bankAccount?.value._tag === "iban"
											? bankAccount?.value.iban
											: "",
								},
							}
						: undefined
				}
			/>
		</div>
	);
}

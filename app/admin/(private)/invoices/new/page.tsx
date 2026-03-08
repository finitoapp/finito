"use client";

import { createIdFromString, sqliteTrue } from "@evolu/common";
import { useSuspenseQuery } from "@tanstack/react-query";
import { addDays } from "date-fns";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { InvoiceForm } from "@/app/admin/(private)/invoices/invoice-form";
import { BackButton } from "@/components/back-button";
import { useEvolu } from "@/hooks/use-evolu";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { useStorageDeps } from "@/hooks/use-storage-deps";
import { createQuery } from "@/lib/evolu";
import { resolveSubsequentInvoiceNumber } from "@/lib/invoice/number-service";

export default function Home() {
	const storageDeps = useStorageDeps();
	const evolu = useEvolu();
	const router = useRouter();
	const [now] = useState(() => new Date());
	const queryFn = useMemo(
		() => () => resolveSubsequentInvoiceNumber(storageDeps),
		[storageDeps],
	);

	const { data: serialNumber } = useSuspenseQuery({
		queryKey: [`serialNumber`],
		queryFn,
		staleTime: 0,
		gcTime: 0,
		refetchOnMount: true,
	});

	// const billingInfoQuery = useMemo(
	// 	() =>
	// 		createQuery((db) =>
	// 			db
	// 				.selectFrom("billingInfo")
	// 				.leftJoin(
	// 					"billingInfoAddress",
	// 					"billingInfoAddress.id",
	// 					"billingInfo.id",
	// 				)
	// 				.leftJoin("billingInfoCz", "billingInfoCz.id", "billingInfo.id")
	// 				.select([
	// 					"billingInfo.id as id",
	// 					"billingInfo.name as name",
	// 					"billingInfo.label as label",
	// 					"billingInfo.email as email",
	// 					"billingInfo.countryCode as countryCode",
	//
	// 					"billingInfoAddress.street as address.street",
	// 					"billingInfoAddress.descriptiveNumber as address.descriptiveNumber",
	// 					"billingInfoAddress.city as address.city",
	// 					"billingInfoAddress.postalCode as address.postalCode",
	//
	// 					"billingInfoCz.vatPayer as cz.vatPayer",
	// 					"billingInfoCz.identificationNumber as cz.identificationNumber",
	// 					"billingInfoCz.vatNumber as cz.vatNumber",
	// 					"billingInfoCz.caseNumber as cz.caseNumber",
	// 				])
	// 				.where("billingInfo.id", "=", createIdFromString(""))
	// 				.where("billingInfo.isDeleted", "is not", sqliteTrue),
	// 		),
	// 	[],
	// );

	const billingSettingsQuery = useMemo(
		() =>
			createQuery((db) =>
				db
					.selectFrom("billingSettings")
					.leftJoin(
						"account",
						"billingSettings.defaultPaymentMethodBankAccountKey",
						"account.id",
					)
					.leftJoin("accountIban", "accountIban.id", "account.id")
					.select([
						"billingSettings.id as id",
						"billingSettings.defaultCurrency as defaultCurrency",
						"billingSettings.defaultInvoiceDueDateDays as defaultInvoiceDueDateDays",
						"billingSettings.defaultPaymentMethodMethod as defaultPaymentMethodMethod",
						"account.id as account",
						"account.id as accountId",
						"account._tag as accountTag",
						"accountIban.iban as accountIban",
					])
					.where("billingSettings.isDeleted", "is not", sqliteTrue)
					.where("account.isDeleted", "is not", sqliteTrue)
					.where("billingSettings.id", "=", createIdFromString("")),
			),
		[],
	);

	const { data: billingSettingsData } = useEvoluQuery(billingSettingsQuery);
	const billingSettings = billingSettingsData[0];

	return (
		<div className={"w-full lg:max-w-7xl"}>
			<div className={"mb-6"}>
				<BackButton />
			</div>

			<InvoiceForm
				onSuccess={async (_, values) => {
					if (values.invoiceNumber === serialNumber?.invoiceNumber) {
						evolu.upsert("invoiceLastNumber", {
							id: createIdFromString(""),
							serialNumber: serialNumber.serialNumber,
							date: serialNumber.date,
						});
					}

					router.push("/admin/invoices");
				}}
				defaultValues={{
					invoiceNumber: serialNumber.invoiceNumber,
					// supplier: {
					// 	billingInfo: nestObjectSkipNullBranches(billingInfo),
					// },
					issueDate: now,
					dueDate: addDays(
						now,
						billingSettings?.defaultInvoiceDueDateDays ?? 14,
					),
					currency: billingSettings?.defaultCurrency ?? undefined,
					payment: {
						method: billingSettings?.defaultPaymentMethodMethod ?? undefined,
						iban:
							billingSettings?.accountTag === "accountIban"
								? (billingSettings?.accountIban ?? "")
								: "",
					},
				}}
			/>
		</div>
	);
}

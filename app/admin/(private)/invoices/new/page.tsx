"use client";

import { createIdFromString, getOrThrow, sqliteTrue } from "@evolu/common";
import { useQuery } from "@tanstack/react-query";
import { addDays } from "date-fns";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { InvoiceForm } from "@/app/admin/(private)/invoices/invoice-form";
import { BackButton } from "@/components/back-button";
import { useCreateQuery } from "@/hooks/use-create-query";
import { useEvolu } from "@/hooks/use-evolu";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { useStorageDeps } from "@/hooks/use-storage-deps";
import { resolveSubsequentInvoiceNumber } from "@/lib/invoice-number-service";
import { nestObjectSkipNullBranches } from "@/lib/object-utils";

export default function Home() {
	const id = useId();
	const storageDeps = useStorageDeps();
	const evolu = useEvolu();
	const router = useRouter();
	const [now] = useState(() => new Date());

	const { data: serialNumber } = useQuery({
		queryKey: [`serialNumber-${id}`],
		queryFn: () => resolveSubsequentInvoiceNumber(storageDeps),
		gcTime: 0,
		staleTime: 0,
	});

	const billingInfoQuery = useCreateQuery(
		(db) =>
			db
				.selectFrom("billingInfo")
				.leftJoin(
					"billingInfoAddress",
					"billingInfoAddress.id",
					"billingInfo.id",
				)
				.leftJoin("billingInfoCz", "billingInfoCz.id", "billingInfo.id")
				.select([
					"billingInfo.id as id",
					"billingInfo.name as name",
					"billingInfo.label as label",
					"billingInfo.email as email",
					"billingInfo.countryCode as countryCode",

					"billingInfoAddress.street as address.street",
					"billingInfoAddress.descriptiveNumber as address.descriptiveNumber",
					"billingInfoAddress.city as address.city",
					"billingInfoAddress.postalCode as address.postalCode",

					"billingInfoCz.vatPayer as cz.vatPayer",
					"billingInfoCz.identificationNumber as cz.identificationNumber",
					"billingInfoCz.vatNumber as cz.vatNumber",
					"billingInfoCz.caseNumber as cz.caseNumber",
				])
				.where("billingInfo.id", "=", createIdFromString(""))
				.where("billingInfo.isDeleted", "is not", sqliteTrue),
		[],
	);

	const billingSettingsQuery = useCreateQuery(
		(db) =>
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
					"account.id as account.id",
					"account._tag as account._tag",
					"accountIban.iban as account.iban",
				])
				.where("billingSettings.isDeleted", "is not", sqliteTrue)
				.where("account.isDeleted", "is not", sqliteTrue)
				.where("billingSettings.id", "=", createIdFromString("")),
		[],
	);

	const { data: billingInfoData } = useEvoluQuery(billingInfoQuery);
	const { data: billingSettingsData } = useEvoluQuery(billingSettingsQuery);
	const billingSettings = billingSettingsData?.[0];
	const billingInfo = billingInfoData?.[0];

	console.log("billingSettings", billingSettings);

	return (
		<div className={"w-full lg:max-w-7xl"}>
			<div className={"mb-6"}>
				<BackButton />
			</div>

			<InvoiceForm
				key={[
					billingInfo ? "true" : "false",
					billingSettings ? "true" : "false",
					serialNumber ? "true" : "false",
				].join(",")}
				onSuccess={async (_, values) => {
					if (values.invoiceNumber === serialNumber?.invoiceNumber) {
						getOrThrow(
							evolu.upsert("invoiceLastNumber", {
								id: createIdFromString(""),
								serialNumber: serialNumber.serialNumber,
								date: serialNumber.date,
							}),
						);
					}

					router.push("/admin/invoices");
				}}
				defaultValues={
					billingInfo
						? {
								invoiceNumber: serialNumber?.invoiceNumber ?? "",
								supplier: {
									billingInfo: nestObjectSkipNullBranches(billingInfo),
								},
								issueDate: now,
								dueDate: addDays(
									now,
									billingSettings?.defaultInvoiceDueDateDays ?? 14,
								),
								currency: billingSettings?.defaultCurrency,
								payment: {
									method:
										billingSettings?.defaultPaymentMethodMethod ?? undefined,
									iban:
										billingSettings?.account?._tag === "accountIban"
											? (billingSettings?.account?.iban ?? "")
											: "",
								},
							}
						: undefined
				}
			/>
		</div>
	);
}

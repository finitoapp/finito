"use client";

import {
	createIdFromString,
	evoluJsonObjectFrom,
	type KyselyNotNull,
	sqliteTrue,
} from "@evolu/common";
import { useSuspenseQuery } from "@tanstack/react-query";
import { addDays } from "date-fns";
import { useAtomValue } from "jotai";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { mapContactToFormContact } from "@/app/admin/(private)/contacts/contact-form";
import { InvoiceForm } from "@/app/admin/(private)/invoices/invoice-form";
import { accountAtom } from "@/atoms/account";
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
	const account = useAtomValue(accountAtom);
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

	const billingSettingsQuery = useMemo(
		() =>
			createQuery((db) =>
				db
					.selectFrom("billingSettings")
					.leftJoin(
						"invoiceSettings",
						"invoiceSettings.id",
						"billingSettings.id",
					)
					.leftJoin(
						"account",
						"billingSettings.defaultPaymentMethodBankAccountKey",
						"account.id",
					)
					.leftJoin("accountIban", "accountIban.id", "account.id")
					.select((eb) => [
						"billingSettings.id as id",
						"billingSettings.defaultCurrency as defaultCurrency",
						"invoiceSettings.defaultDueDateDays as defaultDueDateDays",
						"invoiceSettings.defaultPaymentMethod as defaultPaymentMethod",
						"account.id as account",
						"account.id as accountId",
						"account._tag as accountTag",
						"accountIban.iban as accountIban",

						evoluJsonObjectFrom(
							eb
								.selectFrom("contact")
								.select((eb) => [
									"contact.id as id",
									"contact.createdAt as createdAt",
									"contact.name as name",
									"contact.label as label",
									"contact.email as email",
									"contact.phone as phone",

									evoluJsonObjectFrom(
										eb
											.selectFrom("contactAddress")
											.select([
												"contactAddress.street as street",
												"contactAddress.descriptiveNumber as descriptiveNumber",
												"contactAddress.city as city",
												"contactAddress.postalCode as postalCode",
											])
											.whereRef("contactAddress.id", "=", "contact.id")
											.where("contactAddress.isDeleted", "is not", sqliteTrue),
									).as("address"),

									evoluJsonObjectFrom(
										eb
											.selectFrom("contactBillingInfo")
											.select((eb) => [
												"contactBillingInfo.countryCode as countryCode",

												evoluJsonObjectFrom(
													eb
														.selectFrom("contactBillingInfoCz")
														.select([
															"contactBillingInfoCz.vatPayer as vatPayer",
															"contactBillingInfoCz.identificationNumber as identificationNumber",
															"contactBillingInfoCz.vatNumber as vatNumber",
															"contactBillingInfoCz.caseNumber as caseNumber",
														])
														.whereRef(
															"contactBillingInfoCz.id",
															"=",
															"contact.id",
														)
														.where(
															"contactBillingInfoCz.isDeleted",
															"is not",
															sqliteTrue,
														),
												).as("cz"),
											])
											.whereRef("contactBillingInfo.id", "=", "contact.id")
											.where(
												"contactBillingInfo.isDeleted",
												"is not",
												sqliteTrue,
											)
											.where("contactBillingInfo.countryCode", "is not", null)
											.$narrowType<{
												countryCode: KyselyNotNull;
											}>(),
									).as("billingInfo"),
								])
								.whereRef("contact.id", "=", "billingSettings.ownContactId")
								.where("contact.isDeleted", "is not", sqliteTrue)
								.where("contact.name", "is not", null)
								.$narrowType<{
									name: KyselyNotNull;
								}>(),
						).as("invoiceSupplier"),
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
					deviceId: account.device.id,
					invoiceNumber: serialNumber.invoiceNumber,
					supplier: billingSettings?.invoiceSupplier
						? mapContactToFormContact(billingSettings.invoiceSupplier)
						: undefined,
					issueDate: now,
					dueDate: addDays(now, billingSettings?.defaultDueDateDays ?? 14),
					currency: billingSettings?.defaultCurrency ?? undefined,
					payment: {
						method: billingSettings?.defaultPaymentMethod ?? undefined,
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

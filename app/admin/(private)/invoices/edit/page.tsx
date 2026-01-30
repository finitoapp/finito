"use client";

import { type Id, sqliteTrue } from "@evolu/common";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { InvoiceForm } from "@/app/admin/(private)/invoices/invoice-form";
import { BackButton } from "@/components/back-button";
import { useCreateQuery } from "@/hooks/use-create-query";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { nestObjectSkipNullBranches } from "@/lib/object-utils";

export default function Home() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	if (id === null) {
		throw Promise.reject();
	}

	const invoiceQuery = useCreateQuery(
		(db) =>
			db
				.selectFrom("invoice")
				.leftJoin(
					"invoiceCustomerBillingInfo",
					"invoiceCustomerBillingInfo.id",
					"invoice.id",
				)
				.leftJoin(
					"invoiceCustomerBillingInfoAddress",
					"invoiceCustomerBillingInfoAddress.id",
					"invoice.id",
				)
				.leftJoin(
					"invoiceCustomerBillingInfoCz",
					"invoiceCustomerBillingInfoCz.id",
					"invoice.id",
				)
				.leftJoin(
					"invoiceSupplierBillingInfo",
					"invoiceSupplierBillingInfo.id",
					"invoice.id",
				)
				.leftJoin(
					"invoiceSupplierBillingInfoAddress",
					"invoiceSupplierBillingInfoAddress.id",
					"invoice.id",
				)
				.leftJoin(
					"invoiceSupplierBillingInfoCz",
					"invoiceSupplierBillingInfoCz.id",
					"invoice.id",
				)
				.select([
					"invoice.id as id",
					"invoice.invoiceId as invoiceId",
					"invoice.invoiceNumber as invoiceNumber",
					"invoice.issueDate as issueDate",
					"invoice.dueDate as dueDate",
					"invoice.currency as currency",
					"invoice.paymentMethod as payment.method",
					"invoice.paymentIban as payment.iban",

					"invoiceCustomerBillingInfo.name as customer.billingInfo.name",
					"invoiceCustomerBillingInfo.label as customer.billingInfo.label",
					"invoiceCustomerBillingInfo.email as customer.billingInfo.email",
					"invoiceCustomerBillingInfo.countryCode as customer.billingInfo.countryCode",
					"invoiceCustomerBillingInfoAddress.street as customer.billingInfo.address.street",
					"invoiceCustomerBillingInfoAddress.descriptiveNumber as customer.billingInfo.address.descriptiveNumber",
					"invoiceCustomerBillingInfoAddress.city as customer.billingInfo.address.city",
					"invoiceCustomerBillingInfoAddress.postalCode as customer.billingInfo.address.postalCode",
					"invoiceCustomerBillingInfoCz.identificationNumber as customer.billingInfo.cz.identificationNumber",
					"invoiceCustomerBillingInfoCz.vatNumber as customer.billingInfo.cz.vatNumber",
					"invoiceCustomerBillingInfoCz.caseNumber as customer.billingInfo.cz.caseNumber",

					"invoiceSupplierBillingInfo.name as supplier.billingInfo.name",
					"invoiceSupplierBillingInfo.label as supplier.billingInfo.label",
					"invoiceSupplierBillingInfo.email as supplier.billingInfo.email",
					"invoiceSupplierBillingInfo.countryCode as supplier.billingInfo.countryCode",
					"invoiceSupplierBillingInfoAddress.street as supplier.billingInfo.address.street",
					"invoiceSupplierBillingInfoAddress.descriptiveNumber as supplier.billingInfo.address.descriptiveNumber",
					"invoiceSupplierBillingInfoAddress.city as supplier.billingInfo.address.city",
					"invoiceSupplierBillingInfoAddress.postalCode as supplier.billingInfo.address.postalCode",
					"invoiceSupplierBillingInfoCz.vatPayer as supplier.billingInfo.cz.vatPayer",
					"invoiceSupplierBillingInfoCz.identificationNumber as supplier.billingInfo.cz.identificationNumber",
					"invoiceSupplierBillingInfoCz.vatNumber as supplier.billingInfo.cz.vatNumber",
					"invoiceSupplierBillingInfoCz.caseNumber as supplier.billingInfo.cz.caseNumber",
				])
				.where("invoice.id", "=", id as Id)
				.where("invoice.isDeleted", "is not", sqliteTrue),
		[id],
	);

	const itemsQuery = useCreateQuery(
		(db) =>
			db
				.selectFrom("invoiceItem")
				.selectAll()
				.where("invoiceId", "=", id as Id)
				.where("isDeleted", "is not", sqliteTrue),
		[id],
	);

	const { data: invoiceRows } = useEvoluQuery(invoiceQuery);
	const { data: invoiceItemRows } = useEvoluQuery(itemsQuery);

	const item = useMemo(() => {
		const row = invoiceRows && invoiceRows[0];
		if (!row) return undefined;

		const nested = nestObjectSkipNullBranches(row);
		return {
			...nested,
			items: (invoiceItemRows ?? []).map((it) => ({
				id: it.id,
				label: it.label,
				price: it.price,
				quantity: it.quantity,
				unitOfMeasure: it.unitOfMeasure,
			})),
		};
	}, [invoiceRows, invoiceItemRows]);

	console.log(item);

	return (
		<div className={"w-full lg:max-w-7xl"}>
			<div className={"mb-6"}>
				<BackButton />
			</div>

			<InvoiceForm
				key={item ? "yes" : "no"}
				defaultValues={
					item
						? {
								...item,
								issueDate: new Date(item.issueDate),
								dueDate: new Date(item.dueDate),
								items: item.items.map((it: any) => ({
									...it,
									price:
										typeof it.price === "number"
											? it.price.toFixed()
											: String(it.price ?? 0),
									quantity:
										typeof it.quantity === "number"
											? it.quantity.toFixed()
											: String(it.quantity ?? 0),
									unitOfMeasure: it.unitOfMeasure ?? "",
								})),
							}
						: undefined
				}
				onSuccess={() => router.back()}
			/>
		</div>
	);
}

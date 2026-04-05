"use client";

import {
	evoluJsonArrayFrom,
	evoluJsonObjectFrom,
	type Id,
	type KyselyNotNull,
	sqliteTrue,
} from "@evolu/common";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { mapContactToFormContact } from "@/app/admin/(private)/contacts/contact-form";
import { InvoiceForm } from "@/app/admin/(private)/invoices/invoice-form";
import { BackButton } from "@/components/back-button";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { createQuery } from "@/lib/evolu";
import { moneyCodec } from "@/lib/shared/zod/money-codec";

export default function Home() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	if (id === null) {
		throw Promise.reject();
	}

	const invoiceQuery = useMemo(
		() =>
			createQuery((db) =>
				db
					.selectFrom("invoice")
					.select((eb) => [
						"invoice.id as id",
						"invoice.deviceId as deviceId",
						"invoice.invoiceId as invoiceId",
						"invoice.invoiceNumber as invoiceNumber",
						"invoice.issueDate as issueDate",
						"invoice.dueDate as dueDate",
						"invoice.currency as currency",
						"invoice.paymentMethod as payment.method",
						"invoice.paymentIban as payment.iban",

						evoluJsonArrayFrom(
							eb
								.selectFrom("invoiceItemLine")
								.innerJoin("item", "invoiceItemLine.itemId", "item.id")
								.select([
									"item.id as id",
									"item.label as label",
									"item.price as price",
									"item.currency as currency",
									"invoiceItemLine.quantity as quantity",
									"item.unitOfMeasure as unitOfMeasure",
								] as const)
								.whereRef("invoiceItemLine.invoiceId", "=", "invoice.id")
								.where("item.isDeleted", "is not", sqliteTrue)
								.where("item.label", "is not", null)
								.where("item.price", "is not", null)
								.where("item.currency", "is not", null)
								.where("invoiceItemLine.quantity", "is not", null)
								.$narrowType<{
									label: KyselyNotNull;
									price: KyselyNotNull;
									currency: KyselyNotNull;
									quantity: KyselyNotNull;
								}>(),
						).as("items"),

						evoluJsonObjectFrom(
							eb
								.selectFrom("invoiceCustomer")
								.select((eb) => [
									"invoiceCustomer.id as id",
									"invoiceCustomer.sourceContactId as sourceContactId",
									"invoiceCustomer.name as name",
									"invoiceCustomer.label as label",
									"invoiceCustomer.email as email",
									"invoiceCustomer.phone as phone",

									evoluJsonObjectFrom(
										eb
											.selectFrom("invoiceCustomerBillingInfo")
											.select([
												"invoiceCustomerBillingInfo.countryCode as countryCode",

												evoluJsonObjectFrom(
													eb
														.selectFrom("invoiceCustomerBillingInfoCz")
														.select([
															"invoiceCustomerBillingInfoCz.identificationNumber as identificationNumber",
															"invoiceCustomerBillingInfoCz.vatPayer as vatPayer",
															"invoiceCustomerBillingInfoCz.vatNumber as vatNumber",
															"invoiceCustomerBillingInfoCz.caseNumber as caseNumber",
														])
														.whereRef(
															"invoiceCustomerBillingInfoCz.id",
															"=",
															"invoice.id",
														)
														.where(
															"invoiceCustomerBillingInfoCz.isDeleted",
															"is not",
															sqliteTrue,
														),
												).as("cz"),
											])
											.whereRef(
												"invoiceCustomerBillingInfo.id",
												"=",
												"invoice.id",
											)
											.where(
												"invoiceCustomerBillingInfo.isDeleted",
												"is not",
												sqliteTrue,
											)
											.where(
												"invoiceCustomerBillingInfo.countryCode",
												"is not",
												null,
											)
											.$narrowType<{
												countryCode: KyselyNotNull;
											}>(),
									).as("billingInfo"),

									evoluJsonObjectFrom(
										eb
											.selectFrom("invoiceCustomerAddress")
											.select([
												"invoiceCustomerAddress.street as street",
												"invoiceCustomerAddress.descriptiveNumber as descriptiveNumber",
												"invoiceCustomerAddress.city as city",
												"invoiceCustomerAddress.postalCode as postalCode",
											])
											.whereRef("invoiceCustomerAddress.id", "=", "invoice.id")
											.where(
												"invoiceCustomerAddress.isDeleted",
												"is not",
												sqliteTrue,
											),
									).as("address"),
								])
								.whereRef("invoiceCustomer.id", "=", "invoice.id")
								.where("invoiceCustomer.isDeleted", "is not", sqliteTrue)
								.where("invoiceCustomer.name", "is not", null)
								.$narrowType<{
									name: KyselyNotNull;
								}>(),
						).as("customer"),

						evoluJsonObjectFrom(
							eb
								.selectFrom("invoiceSupplier")
								.select((eb) => [
									"invoiceSupplier.id as id",
									"invoiceSupplier.sourceContactId as sourceContactId",
									"invoiceSupplier.name as name",
									"invoiceSupplier.label as label",
									"invoiceSupplier.email as email",
									"invoiceSupplier.phone as phone",

									evoluJsonObjectFrom(
										eb
											.selectFrom("invoiceSupplierBillingInfo")
											.select([
												"invoiceSupplierBillingInfo.countryCode as countryCode",

												evoluJsonObjectFrom(
													eb
														.selectFrom("invoiceSupplierBillingInfoCz")
														.select([
															"invoiceSupplierBillingInfoCz.identificationNumber as identificationNumber",
															"invoiceSupplierBillingInfoCz.vatPayer as vatPayer",
															"invoiceSupplierBillingInfoCz.vatNumber as vatNumber",
															"invoiceSupplierBillingInfoCz.caseNumber as caseNumber",
														])
														.whereRef(
															"invoiceSupplierBillingInfoCz.id",
															"=",
															"invoice.id",
														)
														.where(
															"invoiceSupplierBillingInfoCz.isDeleted",
															"is not",
															sqliteTrue,
														),
												).as("cz"),
											])
											.whereRef(
												"invoiceSupplierBillingInfo.id",
												"=",
												"invoice.id",
											)
											.where(
												"invoiceSupplierBillingInfo.isDeleted",
												"is not",
												sqliteTrue,
											)
											.where(
												"invoiceSupplierBillingInfo.countryCode",
												"is not",
												null,
											)
											.$narrowType<{
												countryCode: KyselyNotNull;
											}>(),
									).as("billingInfo"),

									evoluJsonObjectFrom(
										eb
											.selectFrom("invoiceSupplierAddress")
											.select([
												"invoiceSupplierAddress.street as street",
												"invoiceSupplierAddress.descriptiveNumber as descriptiveNumber",
												"invoiceSupplierAddress.city as city",
												"invoiceSupplierAddress.postalCode as postalCode",
											])
											.whereRef("invoiceSupplierAddress.id", "=", "invoice.id")
											.where(
												"invoiceSupplierAddress.isDeleted",
												"is not",
												sqliteTrue,
											),
									).as("address"),
								])
								.whereRef("invoiceSupplier.id", "=", "invoice.id")
								.where("invoiceSupplier.isDeleted", "is not", sqliteTrue)
								.where("invoiceSupplier.name", "is not", null)
								.$narrowType<{
									name: KyselyNotNull;
								}>(),
						).as("supplier"),
					])
					.where("invoice.id", "=", id as Id)
					.where("invoice.isDeleted", "is not", sqliteTrue)
					.where("invoice.invoiceId", "is not", null)
					.where("invoice.invoiceNumber", "is not", null)
					.where("invoice.issueDate", "is not", null)
					.where("invoice.dueDate", "is not", null)
					.where("invoice.currency", "is not", null)
					.where("invoice.paymentMethod", "is not", null)
					.$narrowType<{
						invoiceId: KyselyNotNull;
						invoiceNumber: KyselyNotNull;
						issueDate: KyselyNotNull;
						dueDate: KyselyNotNull;
						currency: KyselyNotNull;
						paymentMethod: KyselyNotNull;
						supplier: KyselyNotNull;
						customer: KyselyNotNull;
					}>(),
			),
		[id],
	);

	const { data: invoiceRows } = useEvoluQuery(invoiceQuery);
	const invoice = invoiceRows[0];

	useEffect(() => {
		if (invoice === undefined) {
			router.replace("/admin/invoices");
		}
	}, [invoice, router]);

	if (invoice === undefined) {
		return null;
	}

	return (
		<div className={"w-full lg:max-w-7xl"}>
			<div className={"mb-6"}>
				<BackButton />
			</div>

			<InvoiceForm
				defaultValues={{
					...invoice,
					issueDate: new Date(invoice.issueDate),
					dueDate: new Date(invoice.dueDate),
					supplier: mapContactToFormContact(invoice.supplier),
					customer: mapContactToFormContact(invoice.customer),
					items: invoice.items.map((item) => ({
						...item,
						price: moneyCodec.encode({
							value: item.price,
							currency: invoice.currency,
						}).value,
						quantity: item.quantity.toString(),
						unitOfMeasure: item.unitOfMeasure ?? "",
					})),
				}}
				onSuccess={() => router.back()}
			/>
		</div>
	);
}

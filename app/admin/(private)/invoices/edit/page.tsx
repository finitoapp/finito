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
								.innerJoin(
									"invoiceItem",
									"invoiceItemLine.id",
									"invoiceItem.id",
								)
								.select([
									"invoiceItem.id as id",
									"invoiceItem.label as label",
									"invoiceItem.price as price",
									"invoiceItem.currency as currency",
									"invoiceItemLine.quantity as quantity",
									"invoiceItem.unitOfMeasure as unitOfMeasure",
								] as const)
								.whereRef("invoiceItemLine.invoiceId", "=", "invoice.id")
								.where("invoiceItem.isDeleted", "is not", sqliteTrue)
								.where("invoiceItem.label", "is not", null)
								.where("invoiceItem.price", "is not", null)
								.where("invoiceItem.currency", "is not", null)
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
								.selectFrom("invoiceCustomerBillingInfo")
								.select([
									"invoiceCustomerBillingInfo.name as name",
									"invoiceCustomerBillingInfo.label as label",
									"invoiceCustomerBillingInfo.email as email",
									"invoiceCustomerBillingInfo.countryCode as countryCode",
								])
								.whereRef("invoiceCustomerBillingInfo.id", "=", "invoice.id")
								.where(
									"invoiceCustomerBillingInfo.isDeleted",
									"is not",
									sqliteTrue,
								)
								.where("invoiceCustomerBillingInfo.name", "is not", null)
								.where("invoiceCustomerBillingInfo.countryCode", "is not", null)
								.$narrowType<{
									name: KyselyNotNull;
									countryCode: KyselyNotNull;
								}>(),
						).as("invoiceCustomerBillingInfo"),

						evoluJsonObjectFrom(
							eb
								.selectFrom("invoiceCustomerBillingInfoAddress")
								.select([
									"invoiceCustomerBillingInfoAddress.street as street",
									"invoiceCustomerBillingInfoAddress.descriptiveNumber as descriptiveNumber",
									"invoiceCustomerBillingInfoAddress.city as city",
									"invoiceCustomerBillingInfoAddress.postalCode as postalCode",
								])
								.whereRef(
									"invoiceCustomerBillingInfoAddress.id",
									"=",
									"invoice.id",
								)
								.where(
									"invoiceCustomerBillingInfoAddress.isDeleted",
									"is not",
									sqliteTrue,
								),
						).as("invoiceCustomerBillingInfoAddress"),

						evoluJsonObjectFrom(
							eb
								.selectFrom("invoiceCustomerBillingInfoCz")
								.select([
									"invoiceCustomerBillingInfoCz.vatPayer as vatPayer",
									"invoiceCustomerBillingInfoCz.identificationNumber as identificationNumber",
									"invoiceCustomerBillingInfoCz.vatNumber as vatNumber",
									"invoiceCustomerBillingInfoCz.caseNumber as caseNumber",
								])
								.whereRef("invoiceCustomerBillingInfoCz.id", "=", "invoice.id")
								.where(
									"invoiceCustomerBillingInfoCz.isDeleted",
									"is not",
									sqliteTrue,
								)
								.where("invoiceCustomerBillingInfoCz.vatPayer", "is not", null)
								.where(
									"invoiceCustomerBillingInfoCz.identificationNumber",
									"is not",
									null,
								)
								.$narrowType<{
									vatPayer: KyselyNotNull;
									identificationNumber: KyselyNotNull;
								}>(),
						).as("invoiceCustomerBillingInfoCz"),

						evoluJsonObjectFrom(
							eb
								.selectFrom("invoiceSupplierBillingInfo")
								.select([
									"invoiceSupplierBillingInfo.name as name",
									"invoiceSupplierBillingInfo.label as label",
									"invoiceSupplierBillingInfo.email as email",
									"invoiceSupplierBillingInfo.countryCode as countryCode",
								])
								.whereRef("invoiceSupplierBillingInfo.id", "=", "invoice.id")
								.where(
									"invoiceSupplierBillingInfo.isDeleted",
									"is not",
									sqliteTrue,
								)
								.where("invoiceSupplierBillingInfo.name", "is not", null)
								.where("invoiceSupplierBillingInfo.countryCode", "is not", null)
								.$narrowType<{
									name: KyselyNotNull;
									countryCode: KyselyNotNull;
								}>(),
						).as("invoiceSupplierBillingInfo"),

						evoluJsonObjectFrom(
							eb
								.selectFrom("invoiceSupplierBillingInfoAddress")
								.select([
									"invoiceSupplierBillingInfoAddress.street as street",
									"invoiceSupplierBillingInfoAddress.descriptiveNumber as descriptiveNumber",
									"invoiceSupplierBillingInfoAddress.city as city",
									"invoiceSupplierBillingInfoAddress.postalCode as postalCode",
								])
								.whereRef(
									"invoiceSupplierBillingInfoAddress.id",
									"=",
									"invoice.id",
								)
								.where(
									"invoiceSupplierBillingInfoAddress.isDeleted",
									"is not",
									sqliteTrue,
								),
						).as("invoiceSupplierBillingInfoAddress"),

						evoluJsonObjectFrom(
							eb
								.selectFrom("invoiceSupplierBillingInfoCz")
								.select([
									"invoiceSupplierBillingInfoCz.vatPayer as vatPayer",
									"invoiceSupplierBillingInfoCz.identificationNumber as identificationNumber",
									"invoiceSupplierBillingInfoCz.vatNumber as vatNumber",
									"invoiceSupplierBillingInfoCz.caseNumber as caseNumber",
								])
								.whereRef("invoiceSupplierBillingInfoCz.id", "=", "invoice.id")
								.where(
									"invoiceSupplierBillingInfoCz.isDeleted",
									"is not",
									sqliteTrue,
								)
								.where("invoiceSupplierBillingInfoCz.vatPayer", "is not", null)
								.where(
									"invoiceSupplierBillingInfoCz.identificationNumber",
									"is not",
									null,
								)
								.$narrowType<{
									vatPayer: KyselyNotNull;
									identificationNumber: KyselyNotNull;
								}>(),
						).as("invoiceSupplierBillingInfoCz"),
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

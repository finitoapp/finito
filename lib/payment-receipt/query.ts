import {
	evoluJsonArrayFrom,
	evoluJsonObjectFrom,
	type KyselyNotNull,
	sqliteTrue,
} from "@evolu/common";
import { createQuery } from "@/lib/evolu";
import type { Id } from "@/lib/evolu/types";

export const createPaymentReceiptQuery = (paymentId: Id) =>
	createQuery((db) =>
		db
			.selectFrom("paymentReceipt")
			.select((eb) => [
				"paymentReceipt.id as id",
				"paymentReceipt.receiptNumber as receiptNumber",
				"paymentReceipt.issuedAt as issuedAt",
				"paymentReceipt.paymentCreatedAt as paymentCreatedAt",
				"paymentReceipt.totalAmount as totalAmount",
				"paymentReceipt.currency as currency",

				evoluJsonObjectFrom(
					eb
						.selectFrom("paymentReceiptSupplier")
						.select([
							"paymentReceiptSupplier.id as id",
							"paymentReceiptSupplier.name as name",
							"paymentReceiptSupplier.label as label",
							"paymentReceiptSupplier.email as email",
							"paymentReceiptSupplier.phone as phone",
						] as const)
						.whereRef("paymentReceiptSupplier.id", "=", "paymentReceipt.id")
						.where("paymentReceiptSupplier.isDeleted", "is not", sqliteTrue)
						.where("paymentReceiptSupplier.name", "is not", null)
						.$narrowType<{
							name: KyselyNotNull;
						}>(),
				).as("paymentReceiptSupplier"),

				evoluJsonObjectFrom(
					eb
						.selectFrom("paymentReceiptSupplierAddress")
						.select([
							"paymentReceiptSupplierAddress.street as street",
							"paymentReceiptSupplierAddress.descriptiveNumber as descriptiveNumber",
							"paymentReceiptSupplierAddress.city as city",
							"paymentReceiptSupplierAddress.postalCode as postalCode",
						] as const)
						.whereRef(
							"paymentReceiptSupplierAddress.id",
							"=",
							"paymentReceipt.id",
						)
						.where(
							"paymentReceiptSupplierAddress.isDeleted",
							"is not",
							sqliteTrue,
						),
				).as("paymentReceiptSupplierAddress"),

				evoluJsonObjectFrom(
					eb
						.selectFrom("paymentReceiptSupplierBillingInfo")
						.select([
							"paymentReceiptSupplierBillingInfo.countryCode as countryCode",
						] as const)
						.whereRef(
							"paymentReceiptSupplierBillingInfo.id",
							"=",
							"paymentReceipt.id",
						)
						.where(
							"paymentReceiptSupplierBillingInfo.isDeleted",
							"is not",
							sqliteTrue,
						)
						.where(
							"paymentReceiptSupplierBillingInfo.countryCode",
							"is not",
							null,
						)
						.$narrowType<{
							countryCode: KyselyNotNull;
						}>(),
				).as("paymentReceiptSupplierBillingInfo"),

				evoluJsonObjectFrom(
					eb
						.selectFrom("paymentReceiptSupplierBillingInfoCz")
						.select([
							"paymentReceiptSupplierBillingInfoCz.vatPayer as vatPayer",
							"paymentReceiptSupplierBillingInfoCz.identificationNumber as identificationNumber",
							"paymentReceiptSupplierBillingInfoCz.vatNumber as vatNumber",
							"paymentReceiptSupplierBillingInfoCz.caseNumber as caseNumber",
						] as const)
						.whereRef(
							"paymentReceiptSupplierBillingInfoCz.id",
							"=",
							"paymentReceipt.id",
						)
						.where(
							"paymentReceiptSupplierBillingInfoCz.isDeleted",
							"is not",
							sqliteTrue,
						),
				).as("paymentReceiptSupplierBillingInfoCz"),

				evoluJsonArrayFrom(
					eb
						.selectFrom("paymentReceiptItemLine")
						.select([
							"paymentReceiptItemLine.id as id",
							"paymentReceiptItemLine.kind as kind",
							"paymentReceiptItemLine.sortOrder as sortOrder",
							"paymentReceiptItemLine.label as label",
							"paymentReceiptItemLine.quantity as quantity",
							"paymentReceiptItemLine.unitOfMeasure as unitOfMeasure",
							"paymentReceiptItemLine.unitPrice as unitPrice",
							"paymentReceiptItemLine.totalAmount as totalAmount",
						] as const)
						.whereRef(
							"paymentReceiptItemLine.paymentReceiptId",
							"=",
							"paymentReceipt.id",
						)
						.where("paymentReceiptItemLine.isDeleted", "is not", sqliteTrue)
						.where("paymentReceiptItemLine.kind", "is not", null)
						.where("paymentReceiptItemLine.sortOrder", "is not", null)
						.where("paymentReceiptItemLine.quantity", "is not", null)
						.where("paymentReceiptItemLine.unitPrice", "is not", null)
						.where("paymentReceiptItemLine.totalAmount", "is not", null)
						.orderBy("paymentReceiptItemLine.sortOrder", "asc")
						.$narrowType<{
							kind: KyselyNotNull;
							sortOrder: KyselyNotNull;
							quantity: KyselyNotNull;
							unitPrice: KyselyNotNull;
							totalAmount: KyselyNotNull;
						}>(),
				).as("items"),
			])
			.where("paymentReceipt.isDeleted", "is not", sqliteTrue)
			.where("paymentReceipt.id", "=", paymentId)
			.where("paymentReceipt.receiptNumber", "is not", null)
			.where("paymentReceipt.issuedAt", "is not", null)
			.where("paymentReceipt.paymentCreatedAt", "is not", null)
			.where("paymentReceipt.totalAmount", "is not", null)
			.where("paymentReceipt.currency", "is not", null)
			.$narrowType<{
				receiptNumber: KyselyNotNull;
				issuedAt: KyselyNotNull;
				paymentCreatedAt: KyselyNotNull;
				totalAmount: KyselyNotNull;
				currency: KyselyNotNull;
				items: KyselyNotNull;
				paymentReceiptSupplier: KyselyNotNull;
				paymentReceiptSupplierAddress: KyselyNotNull;
				paymentReceiptSupplierBillingInfo: KyselyNotNull;
				paymentReceiptSupplierBillingInfoCz: KyselyNotNull;
			}>(),
	);

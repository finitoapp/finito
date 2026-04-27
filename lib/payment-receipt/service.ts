import {
	createIdFromString,
	err,
	evoluJsonArrayFrom,
	evoluJsonObjectFrom,
	type KyselyNotNull,
	ok,
	type Result,
	sqliteTrue,
} from "@evolu/common";
import { createQuery } from "@/lib/evolu";
import { PaymentReceiptLineKind } from "@/lib/evolu/model/payment-receipt";
import { PaymentStatus } from "@/lib/evolu/model/payment-status";
import type { Id } from "@/lib/evolu/types";
import { resolvePaymentStatus } from "@/lib/payment/service";
import { resolveSubsequentPaymentReceiptNumber } from "@/lib/payment-receipt/number-service";
import type { EvoluDep } from "@/lib/shared/dependencies";
import { defineError } from "@/lib/shared/error";
import {
	Integer,
	NonEmptyString,
	NonEmptyString255,
	PositiveInteger,
} from "@/lib/shared/types";

const createIssuePaymentReceiptPaymentNotFoundError = defineError(
	"IssuePaymentReceiptPaymentNotFoundError",
)<{
	paymentId: Id;
}>();
export type IssuePaymentReceiptPaymentNotFoundError = ReturnType<
	typeof createIssuePaymentReceiptPaymentNotFoundError
>;

const createIssuePaymentReceiptUnsupportedDirectionError = defineError(
	"IssuePaymentReceiptUnsupportedDirectionError",
)<{
	paymentId: Id;
}>();
export type IssuePaymentReceiptUnsupportedDirectionError = ReturnType<
	typeof createIssuePaymentReceiptUnsupportedDirectionError
>;

const createIssuePaymentReceiptPaymentNotSettledError = defineError(
	"IssuePaymentReceiptPaymentNotSettledError",
)<{
	paymentId: Id;
}>();
export type IssuePaymentReceiptPaymentNotSettledError = ReturnType<
	typeof createIssuePaymentReceiptPaymentNotSettledError
>;

const createIssuePaymentReceiptSupplierNotConfiguredError = defineError(
	"IssuePaymentReceiptSupplierNotConfiguredError",
)();
export type IssuePaymentReceiptSupplierNotConfiguredError = ReturnType<
	typeof createIssuePaymentReceiptSupplierNotConfiguredError
>;

const createIssuePaymentReceiptSupplierBillingInfoMissingError = defineError(
	"IssuePaymentReceiptSupplierBillingInfoMissingError",
)();
export type IssuePaymentReceiptSupplierBillingInfoMissingError = ReturnType<
	typeof createIssuePaymentReceiptSupplierBillingInfoMissingError
>;

export type IssuePaymentReceiptError =
	| IssuePaymentReceiptPaymentNotFoundError
	| IssuePaymentReceiptUnsupportedDirectionError
	| IssuePaymentReceiptPaymentNotSettledError
	| IssuePaymentReceiptSupplierNotConfiguredError
	| IssuePaymentReceiptSupplierBillingInfoMissingError;

type PaymentReceiptLineDraft = {
	kind: (typeof PaymentReceiptLineKind)[keyof typeof PaymentReceiptLineKind];
	label: string | null;
	quantity: number;
	unitOfMeasure: string | null;
	unitPrice: number;
	totalAmount: number;
};

const buildPaymentReceiptLines = (params: {
	items: Array<{
		quantity: number;
		totalAmount: number;
		item: {
			label: string;
			price: number;
			unitOfMeasure: string | null;
		};
	}>;
	tipAmount: number | null;
	settledAmount: number;
}) => {
	const lines: PaymentReceiptLineDraft[] = params.items.map((item) => ({
		kind: PaymentReceiptLineKind.Item,
		label: item.item.label,
		quantity: item.quantity,
		unitOfMeasure: item.item.unitOfMeasure,
		unitPrice: item.item.price,
		totalAmount: item.totalAmount,
	}));

	if (params.tipAmount !== null && params.tipAmount > 0) {
		lines.push({
			kind: PaymentReceiptLineKind.Tip,
			label: null,
			quantity: 1,
			unitOfMeasure: null,
			unitPrice: params.tipAmount,
			totalAmount: params.tipAmount,
		});
	}

	const linesTotal = Integer(
		lines.reduce((acc, line) => acc + line.totalAmount, 0),
	);
	const settlementAdjustment = Integer(params.settledAmount - linesTotal);

	if (lines.length === 0) {
		lines.push({
			kind: PaymentReceiptLineKind.Payment,
			label: null,
			quantity: 1,
			unitOfMeasure: null,
			unitPrice: params.settledAmount,
			totalAmount: params.settledAmount,
		});
	} else if (settlementAdjustment !== 0) {
		lines.push({
			kind: PaymentReceiptLineKind.SettlementAdjustment,
			label: null,
			quantity: 1,
			unitOfMeasure: null,
			unitPrice: settlementAdjustment,
			totalAmount: settlementAdjustment,
		});
	}

	return lines;
};

export const issuePaymentReceipt =
	(deps: EvoluDep) =>
	async (params: {
		paymentId: Id;
	}): Promise<
		Result<
			{
				receiptId: Id;
				wasCreated: boolean;
			},
			IssuePaymentReceiptError
		>
	> => {
		const existingReceiptRows = await deps.evolu.loadQuery(
			createQuery((db) =>
				db
					.selectFrom("paymentReceipt")
					.select(["paymentReceipt.id as id"] as const)
					.where("paymentReceipt.isDeleted", "is not", sqliteTrue)
					.where("paymentReceipt.id", "=", params.paymentId)
					.limit(1),
			),
		);
		if (existingReceiptRows[0] !== undefined) {
			return ok({
				receiptId: params.paymentId,
				wasCreated: false,
			});
		}

		const paymentRows = await deps.evolu.loadQuery(
			createQuery((db) =>
				db
					.selectFrom("payment")
					.select((eb) => [
						"payment.id as id",
						"payment.deviceId as deviceId",
						"payment.createdAt as createdAt",
						"payment.direction as direction",
						"payment.totalAmount as totalAmount",
						"payment.currency as currency",
						"payment.tipAmount as tipAmount",

						evoluJsonArrayFrom(
							eb
								.selectFrom("paymentItemLine")
								.select(
									(eb) =>
										[
											"paymentItemLine.quantity as quantity",
											"paymentItemLine.totalAmount as totalAmount",

											evoluJsonObjectFrom(
												eb
													.selectFrom("item")
													.select([
														"item.label as label",
														"item.price as price",
														"item.unitOfMeasure as unitOfMeasure",
													] as const)
													.whereRef("item.id", "=", "paymentItemLine.itemId")
													.where("item.isDeleted", "is not", sqliteTrue)
													.where("item.label", "is not", null)
													.where("item.price", "is not", null)
													.$narrowType<{
														label: KyselyNotNull;
														price: KyselyNotNull;
													}>(),
											).as("item"),
										] as const,
								)
								.whereRef("paymentItemLine.paymentId", "=", "payment.id")
								.where("paymentItemLine.isDeleted", "is not", sqliteTrue)
								.where("paymentItemLine.quantity", "is not", null)
								.where("paymentItemLine.totalAmount", "is not", null)
								.$narrowType<{
									quantity: KyselyNotNull;
									totalAmount: KyselyNotNull;
									item: KyselyNotNull;
								}>(),
						).as("items"),

						evoluJsonObjectFrom(
							eb
								.selectFrom("reconciliationClaim")
								.innerJoin(
									"reconciliationClaimAllocation",
									"reconciliationClaimAllocation.claimId",
									"reconciliationClaim.id",
								)
								.select(
									(eb) =>
										[
											eb.fn
												.sum<number | null>(
													"reconciliationClaimAllocation.amount",
												)
												.as("amount"),
										] as const,
								)
								.whereRef("reconciliationClaim.entityId", "=", "payment.id")
								.where("reconciliationClaim.isDeleted", "is not", sqliteTrue)
								.where(
									"reconciliationClaimAllocation.isDeleted",
									"is not",
									sqliteTrue,
								)
								.where("reconciliationClaim.entityType", "=", "payment"),
						).as("reconciliationClaim"),
					])
					.where("payment.isDeleted", "is not", sqliteTrue)
					.where("payment.id", "=", params.paymentId)
					.where("payment.direction", "is not", null)
					.where("payment.totalAmount", "is not", null)
					.where("payment.currency", "is not", null)
					.limit(1)
					.$narrowType<{
						direction: KyselyNotNull;
						totalAmount: KyselyNotNull;
						currency: KyselyNotNull;
						items: KyselyNotNull;
						reconciliationClaim: KyselyNotNull;
					}>(),
			),
		);

		const payment = paymentRows[0];
		if (payment === undefined) {
			return err(
				createIssuePaymentReceiptPaymentNotFoundError({
					paymentId: params.paymentId,
				}),
			);
		}

		if (payment.direction !== "incoming") {
			return err(
				createIssuePaymentReceiptUnsupportedDirectionError({
					paymentId: params.paymentId,
				}),
			);
		}

		const paymentReconciliationAmount =
			payment.reconciliationClaim.amount === null
				? null
				: Integer(payment.reconciliationClaim.amount);
		const paymentStatus = resolvePaymentStatus({
			payment: {
				totalAmount: payment.totalAmount,
				reconciliationClaim: {
					amount: paymentReconciliationAmount,
				},
			},
		});
		if (paymentStatus === PaymentStatus.Unpaid) {
			return err(
				createIssuePaymentReceiptPaymentNotSettledError({
					paymentId: params.paymentId,
				}),
			);
		}

		const settledAmount = paymentReconciliationAmount;
		if (settledAmount === null || settledAmount <= 0) {
			return err(
				createIssuePaymentReceiptPaymentNotSettledError({
					paymentId: params.paymentId,
				}),
			);
		}

		const supplierRows = await deps.evolu.loadQuery(
			createQuery((db) =>
				db
					.selectFrom("billingSettings")
					.select((eb) => [
						evoluJsonObjectFrom(
							eb
								.selectFrom("contact")
								.select((eb) => [
									"contact.id as id",
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
											] as const)
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
														] as const)
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
						).as("supplier"),
					])
					.where("billingSettings.isDeleted", "is not", sqliteTrue)
					.where("billingSettings.id", "=", createIdFromString(""))
					.limit(1),
			),
		);

		const supplier = supplierRows[0]?.supplier;
		if (supplier === null || supplier === undefined) {
			return err(createIssuePaymentReceiptSupplierNotConfiguredError());
		}

		if (supplier.billingInfo === null || supplier.billingInfo === undefined) {
			return err(createIssuePaymentReceiptSupplierBillingInfoMissingError());
		}

		const nextReceiptNumber = await resolveSubsequentPaymentReceiptNumber(deps);
		const issuedAt = Date.now();

		deps.evolu.upsert("paymentReceipt", {
			id: params.paymentId,
			deviceId: payment.deviceId,
			receiptNumber: NonEmptyString255(nextReceiptNumber.receiptNumber),
			issuedAt,
			paymentCreatedAt: NonEmptyString255(payment.createdAt),
			totalAmount: Integer(settledAmount),
			currency: payment.currency,
		});

		deps.evolu.upsert("paymentReceiptSupplier", {
			id: params.paymentId,
			name: supplier.name,
			label: supplier.label,
			email: supplier.email,
			phone: supplier.phone,
		});
		deps.evolu.upsert("paymentReceiptSupplierAddress", {
			id: params.paymentId,
			street: supplier.address?.street ?? null,
			descriptiveNumber: supplier.address?.descriptiveNumber ?? null,
			city: supplier.address?.city ?? null,
			postalCode: supplier.address?.postalCode ?? null,
		});
		deps.evolu.upsert("paymentReceiptSupplierBillingInfo", {
			id: params.paymentId,
			countryCode: supplier.billingInfo.countryCode,
		});
		deps.evolu.upsert("paymentReceiptSupplierBillingInfoCz", {
			id: params.paymentId,
			vatPayer: supplier.billingInfo.cz?.vatPayer ?? null,
			identificationNumber:
				supplier.billingInfo.cz?.identificationNumber ?? null,
			vatNumber: supplier.billingInfo.cz?.vatNumber ?? null,
			caseNumber: supplier.billingInfo.cz?.caseNumber ?? null,
		});

		const lines = buildPaymentReceiptLines({
			items: payment.items,
			tipAmount: payment.tipAmount,
			settledAmount,
		});

		for (const [index, line] of lines.entries()) {
			deps.evolu.upsert("paymentReceiptItemLine", {
				id: createIdFromString(
					`${params.paymentId}:paymentReceiptItemLine:${index}`,
				),
				paymentReceiptId: params.paymentId,
				kind: line.kind,
				sortOrder: PositiveInteger(index + 1),
				label: line.label !== null ? NonEmptyString255(line.label) : null,
				quantity: line.quantity,
				unitOfMeasure:
					line.unitOfMeasure !== null
						? NonEmptyString(line.unitOfMeasure)
						: null,
				unitPrice: Integer(line.unitPrice),
				totalAmount: Integer(line.totalAmount),
			});
		}

		deps.evolu.upsert("paymentReceiptLastNumber", {
			id: createIdFromString(""),
			serialNumber: nextReceiptNumber.serialNumber,
			date: nextReceiptNumber.date,
		});

		return ok({
			receiptId: params.paymentId,
			wasCreated: true,
		});
	};

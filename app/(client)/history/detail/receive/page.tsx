"use client";

import {
	evoluJsonArrayFrom,
	evoluJsonObjectFrom,
	type Id,
	type KyselyNotNull,
	sqliteTrue,
} from "@evolu/common";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FadeHeader } from "@/components/fade-header";
import { LoadingIndicator } from "@/components/loading-indicator";
import { ReceivePayment } from "@/components/receive-payment";
import { Button } from "@/components/ui/button";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { createQuery } from "@/lib/evolu";
import { PaymentStatus } from "@/lib/evolu/model/payment-status";
import { generateCzechBankQrCode } from "@/lib/payment/czech-bank-qr-generator";
import type { Integer } from "@/lib/shared/types";
import { clientBaseUrl } from "@/lib/shared/utils/window";

export default function Page() {
	const { t } = useTranslation();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	if (id === null) throw Promise.reject();

	const paymentId = id as Id;

	const paymentInitQuery = useMemo(
		() =>
			createQuery((db) =>
				db
					.selectFrom("payment")
					.select(
						(eb) =>
							[
								"id",
								"createdAt",
								"totalAmount",
								"currency",
								"tipAmount",
								"direction",

								evoluJsonArrayFrom(
									eb
										.selectFrom("paymentItemLine")
										.select(
											(eb) =>
												[
													"paymentItemLine.totalAmount as totalAmount",
													"paymentItemLine.quantity as quantity",

													evoluJsonObjectFrom(
														eb
															.selectFrom("itemRevision")
															.select(["itemRevision.label as label"])
															.whereRef(
																"itemRevision.id",
																"=",
																"paymentItemLine.itemRevisionId",
															)
															.where(
																"itemRevision.isDeleted",
																"is not",
																sqliteTrue,
															)
															.where("itemRevision.label", "is not", null)
															.$narrowType<{
																label: KyselyNotNull;
															}>(),
													).as("item"),
												] as const,
										)
										.whereRef("paymentItemLine.paymentId", "=", "payment.id")
										.where("paymentItemLine.isDeleted", "is not", sqliteTrue)
										.where("paymentItemLine.totalAmount", "is not", null)
										.where("paymentItemLine.quantity", "is not", null)
										.$narrowType<{
											totalAmount: KyselyNotNull;
											quantity: KyselyNotNull;
											item: KyselyNotNull;
										}>(),
								).as("items"),

								evoluJsonObjectFrom(
									eb
										.selectFrom("paymentBankTransferCZ")
										.select(["iban", "variableSymbol"] as const)
										.whereRef("paymentBankTransferCZ.id", "=", "payment.id")
										.where(
											"paymentBankTransferCZ.isDeleted",
											"is not",
											sqliteTrue,
										)
										.where("paymentBankTransferCZ.iban", "is not", null)
										.where(
											"paymentBankTransferCZ.variableSymbol",
											"is not",
											null,
										)
										.$narrowType<{
											iban: KyselyNotNull;
											variableSymbol: KyselyNotNull;
										}>(),
								).as("paymentBankTransferCZ"),

								evoluJsonObjectFrom(
									eb
										.selectFrom("paymentLnZap")
										.select([
											"lnInvoice",
											"walletPubkey",
											"expirationIn",
										] as const)
										.whereRef("paymentLnZap.id", "=", "payment.id")
										.where("paymentLnZap.isDeleted", "is not", sqliteTrue)
										.where("paymentLnZap.lnInvoice", "is not", null)
										.where("paymentLnZap.walletPubkey", "is not", null)
										.where("paymentLnZap.expirationIn", "is not", null)
										.$narrowType<{
											lnInvoice: KyselyNotNull;
											walletPubkey: KyselyNotNull;
											expirationIn: KyselyNotNull;
										}>(),
								).as("paymentLnZap"),

								evoluJsonObjectFrom(
									eb
										.selectFrom("paymentLnSpark")
										.select(["lnInvoice", "expirationIn"] as const)
										.whereRef("paymentLnSpark.id", "=", "payment.id")
										.where("paymentLnSpark.isDeleted", "is not", sqliteTrue)
										.where("paymentLnSpark.lnInvoice", "is not", null)
										.where("paymentLnSpark.expirationIn", "is not", null)
										.$narrowType<{
											lnInvoice: KyselyNotNull;
											walletPubkey: KyselyNotNull;
											expirationIn: KyselyNotNull;
										}>(),
								).as("paymentLnSpark"),

								evoluJsonObjectFrom(
									eb
										.selectFrom("paymentCash")
										.select(["accountId"] as const)
										.whereRef("paymentCash.id", "=", "payment.id")
										.where("paymentCash.isDeleted", "is not", sqliteTrue)
										.where("paymentCash.accountId", "is not", null)
										.$narrowType<{
											accountId: KyselyNotNull;
										}>(),
								).as("paymentCash"),

								evoluJsonObjectFrom(
									eb
										.selectFrom("paymentWebData")
										.select(["privateKey", "webPaymentEventId"] as const)
										.whereRef("paymentWebData.id", "=", "payment.id")
										.where("paymentWebData.isDeleted", "is not", sqliteTrue)
										.where("paymentWebData.privateKey", "is not", null)
										.where("paymentWebData.webPaymentEventId", "is not", null)
										.$narrowType<{
											privateKey: KyselyNotNull;
											webPaymentEventId: KyselyNotNull;
										}>(),
								).as("paymentWebData"),

								evoluJsonObjectFrom(
									eb
										.selectFrom("paymentWatchingState")
										.select([
											"verifiedAt",
											"proveType",
											"transactionId",
											"stoppedAt",
											"stopReason",
										] as const)
										.whereRef("paymentWatchingState.id", "=", "payment.id")
										.where(
											"paymentWatchingState.isDeleted",
											"is not",
											sqliteTrue,
										),
								).as("paymentWatchingState"),

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
														.sum<Integer | null>(
															"reconciliationClaimAllocation.amount",
														)
														.as("amount"),
												] as const,
										)
										.whereRef("reconciliationClaim.entityId", "=", "payment.id")
										.where(
											"reconciliationClaim.isDeleted",
											"is not",
											sqliteTrue,
										)
										.where(
											"reconciliationClaimAllocation.isDeleted",
											"is not",
											sqliteTrue,
										)
										.where("reconciliationClaim.entityType", "=", "payment"),
								).as("reconciliationClaim"),
							] as const,
					)
					.where("payment.isDeleted", "is not", sqliteTrue)
					.where("payment.currency", "is not", null)
					.where("payment.totalAmount", "is not", null)
					.where("payment.direction", "is not", null)
					.where("payment.id", "=", paymentId)
					.limit(1)
					.$narrowType<{
						currency: KyselyNotNull;
						totalAmount: KyselyNotNull;
						direction: KyselyNotNull;
						reconciliationClaim: KyselyNotNull;
					}>(),
			),
		[paymentId],
	);

	const { data: paymentInitRows } = useEvoluQuery(paymentInitQuery);

	const payment = paymentInitRows[0];

	const czechQRCode =
		(payment &&
			payment.paymentBankTransferCZ &&
			generateCzechBankQrCode({
				amount: payment.totalAmount / 100,
				currency: payment.currency,
				iban: payment.paymentBankTransferCZ.iban,
				variableSymbol: payment.paymentBankTransferCZ.variableSymbol,
				useInstantPayment: true,
			})) ??
		undefined;

	const frontendUrl =
		(payment &&
			payment.paymentWebData &&
			`${clientBaseUrl}#s-${payment.paymentWebData.privateKey}`) ??
		undefined;

	const paymentStatus: PaymentStatus =
		payment && payment.reconciliationClaim.amount
			? payment.reconciliationClaim.amount > payment.totalAmount
				? PaymentStatus.Overpaid
				: payment.reconciliationClaim.amount < payment.totalAmount
					? PaymentStatus.Underpaid
					: PaymentStatus.Paid
			: PaymentStatus.Unpaid;

	const lightningPayment = payment.paymentLnSpark ?? payment.paymentLnZap;

	return (
		<div className="space-y-8 w-full px-8">
			<div className={"h-8"} />
			<FadeHeader title={t("client:page.paymentDetail")} />

			{paymentStatus === PaymentStatus.Paid ? (
				<div className={"h-full w-full flex flex-col justify-evenly"}>
					<LoadingIndicator
						text={t("payments:detail.messages.payment-successfully-paid")}
						open={true}
						status={"success"}
					/>

					<Button
						variant={"outline"}
						nativeButton={false}
						render={
							<Link href={`/history/detail?id=${encodeURIComponent(id)}`} />
						}
					>
						Continue to the payment detail
					</Button>
				</div>
			) : (
				<ReceivePayment
					frontendUrl={frontendUrl}
					lnInvoice={lightningPayment?.lnInvoice}
					czechQRCode={czechQRCode}
					totalAmount={payment.totalAmount}
					currency={payment.currency}
					note={lightningPayment?.lnInvoice}
				/>
			)}

			<div className={"h-0"}></div>
		</div>
	);
}

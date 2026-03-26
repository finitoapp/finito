"use client";

import {
	evoluJsonArrayFrom,
	evoluJsonObjectFrom,
	type Id,
	type KyselyNotNull,
	sqliteTrue,
} from "@evolu/common";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FadeHeader } from "@/components/fade-header";
import { FieldRow } from "@/components/field-row";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { createQuery } from "@/lib/evolu";
import { resolvePaymentStatus } from "@/lib/payment/service";
import type { Integer } from "@/lib/shared/types";
import { formatDateTime, formatMoney } from "@/lib/shared/utils/format";

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
										.selectFrom("paymentCounterparty")
										.select([
											"paymentCounterparty.label as label",
											"paymentCounterparty.name as name",
										] as const)
										.whereRef("paymentCounterparty.id", "=", "payment.id")
										.where(
											"paymentCounterparty.isDeleted",
											"is not",
											sqliteTrue,
										),
								).as("paymentCounterparty"),

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
											expirationIn: KyselyNotNull;
										}>(),
								).as("paymentLnSpark"),

								evoluJsonObjectFrom(
									eb
										.selectFrom("paymentLnNwc")
										.select(["lnInvoice", "expirationIn"] as const)
										.whereRef("paymentLnNwc.id", "=", "payment.id")
										.where("paymentLnNwc.isDeleted", "is not", sqliteTrue)
										.where("paymentLnNwc.lnInvoice", "is not", null)
										.where("paymentLnNwc.expirationIn", "is not", null)
										.$narrowType<{
											lnInvoice: KyselyNotNull;
											expirationIn: KyselyNotNull;
										}>(),
								).as("paymentLnNwc"),

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

	if (payment === undefined) return null;

	const paymentStatus = resolvePaymentStatus({ payment });
	const paymentCounterpartyLabel =
		payment.paymentCounterparty?.label ??
		payment.paymentCounterparty?.name ??
		null;

	return (
		<div className="space-y-8 w-full px-4">
			<div className={"h-8"} />
			<FadeHeader title={t("client:page.paymentDetail")} />

			<Card>
				<CardContent>
					<FieldRow
						label={t("client:historyDetail.fields.status")}
						value={t(`client:historyDetail.status.${paymentStatus}`)}
					/>
					<FieldRow
						label={t("client:historyDetail.fields.counterparty")}
						value={paymentCounterpartyLabel}
					/>
					<FieldRow
						label={t("client:historyDetail.fields.spending")}
						value={formatMoney({
							value: payment.totalAmount,
							currency: payment.currency,
						})}
					/>

					{payment.tipAmount && (
						<FieldRow
							label={t("client:bill.tipForStaff")}
							value={formatMoney({
								value: payment.tipAmount,
								currency: payment.currency,
							})}
						/>
					)}

					<FieldRow
						label={t("client:historyDetail.fields.date")}
						value={formatDateTime(new Date(payment.createdAt))}
					/>
				</CardContent>
			</Card>

			{payment.items.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle>{t("client:bill.itemsTitle")}</CardTitle>
					</CardHeader>
					<CardContent>
						{payment.items.map((item) => (
							<FieldRow
								key={`${item.item.label}:${item.quantity ?? 0}:${item.totalAmount}`}
								label={`${item.quantity ?? 0}× ${item.item.label}`}
								value={formatMoney({
									value: item.totalAmount,
									currency: payment.currency,
								})}
							/>
						))}
					</CardContent>
				</Card>
			)}

			{(payment.paymentLnZap ||
				payment.paymentLnSpark ||
				payment.paymentLnNwc ||
				payment.paymentBankTransferCZ) && (
				<Card>
					<CardHeader>
						<CardTitle>{t("client:historyDetail.metadata.title")}</CardTitle>
					</CardHeader>
					<CardContent>
						{payment.paymentLnZap && (
							<>
								<FieldRow
									label={t("client:historyDetail.metadata.fields.lnZapInvoice")}
									value={payment.paymentLnZap.lnInvoice}
								/>
								<FieldRow
									label={t(
										"client:historyDetail.metadata.fields.lnZapWalletPubkey",
									)}
									value={payment.paymentLnZap.walletPubkey}
								/>
								<FieldRow
									label={t(
										"client:historyDetail.metadata.fields.lnZapExpiration",
									)}
									value={formatDateTime(
										new Date(payment.paymentLnZap.expirationIn),
									)}
								/>
							</>
						)}
						{payment.paymentLnSpark && (
							<>
								<FieldRow
									label={t(
										"client:historyDetail.metadata.fields.lnSparkInvoice",
									)}
									value={payment.paymentLnSpark.lnInvoice}
								/>
								<FieldRow
									label={t(
										"client:historyDetail.metadata.fields.lnSparkExpiration",
									)}
									value={formatDateTime(
										new Date(payment.paymentLnSpark.expirationIn),
									)}
								/>
							</>
						)}
						{payment.paymentLnNwc && (
							<>
								<FieldRow
									label={t("client:historyDetail.metadata.fields.lnNwcInvoice")}
									value={payment.paymentLnNwc.lnInvoice}
								/>
								<FieldRow
									label={t(
										"client:historyDetail.metadata.fields.lnNwcExpiration",
									)}
									value={formatDateTime(
										new Date(payment.paymentLnNwc.expirationIn),
									)}
								/>
							</>
						)}
						{payment.paymentBankTransferCZ && (
							<>
								<FieldRow
									label={t(
										"client:historyDetail.metadata.fields.bankTransferIban",
									)}
									value={payment.paymentBankTransferCZ.iban}
								/>
								<FieldRow
									label={t(
										"client:historyDetail.metadata.fields.bankTransferVariableSymbol",
									)}
									value={payment.paymentBankTransferCZ.variableSymbol}
								/>
							</>
						)}
					</CardContent>
				</Card>
			)}

			{/*<div className={"flex justify-center px-4"}>*/}
			{/*	<Button className={"w-full"} type={"button"}>*/}
			{/*		<DownloadIcon />*/}
			{/*		{t("client:historyDetail.actions.downloadReceipt")}*/}
			{/*	</Button>*/}
			{/*</div>*/}

			<div className={"h-0"}></div>
		</div>
	);
}

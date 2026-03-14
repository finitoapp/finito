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
import { KeyValueList } from "@/components/key-value-list";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { createQuery } from "@/lib/evolu";
import { formatMoney } from "@/lib/shared/utils/format";

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
					}>(),
			),
		[paymentId],
	);

	const { data: paymentInitRows } = useEvoluQuery(paymentInitQuery);

	const payment = paymentInitRows[0];

	return (
		<div className="space-y-8 w-full">
			<div className={"h-20"} />
			<FadeHeader title={t("client:page.paymentDetail")} />

			<ResponsiveCard>
				<CardContent>
					<KeyValueList
						items={[
							{
								key: t("client:historyDetail.fields.spending"),
								value: payment ? (
									formatMoney({
										value: payment.totalAmount,
										currency: payment.currency,
									})
								) : (
									<Skeleton className={"h-5 w-50"} />
								),
							},
							...(payment.tipAmount
								? [
										{
											key: t("client:bill.tipForStaff"),
											value: formatMoney({
												value: payment.tipAmount,
												currency: payment.currency,
											}),
										},
									]
								: []),
							{
								key: t("client:historyDetail.fields.date"),
								value: payment ? (
									new Date(payment.createdAt).toLocaleString()
								) : (
									<Skeleton className={"h-5 w-50"} />
								),
							},
						]}
					/>
				</CardContent>
			</ResponsiveCard>

			{payment.items.length > 0 && (
				<ResponsiveCard>
					<CardHeader>
						<CardTitle>{t("client:bill.itemsTitle")}</CardTitle>
					</CardHeader>
					<CardContent>
						<KeyValueList
							items={payment.items.map((item) => ({
								key: `${item.quantity ?? 0}× ${item.item.label}`,
								value: formatMoney({
									value: item.totalAmount,
									currency: payment.currency,
								}),
							}))}
						/>
					</CardContent>
				</ResponsiveCard>
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

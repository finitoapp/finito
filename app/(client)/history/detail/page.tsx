"use client";

import { type Id, kysely, sqliteTrue } from "@evolu/common";
import type { NotNull } from "kysely";
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

								kysely
									.jsonArrayFrom(
										eb
											.selectFrom("paymentItemLine")
											.select(
												(eb) =>
													[
														"paymentItemLine.totalAmount as totalAmount",
														"paymentItemLine.quantity as quantity",

														kysely
															.jsonObjectFrom(
																eb
																	.selectFrom("paymentItem")
																	.select(["paymentItem.label as label"])
																	.whereRef(
																		"paymentItem.id",
																		"=",
																		"paymentItemLine.id",
																	)
																	.where(
																		"paymentItem.isDeleted",
																		"is not",
																		sqliteTrue,
																	)
																	.where("paymentItem.label", "is not", null)
																	.$narrowType<{
																		label: NotNull;
																	}>(),
															)
															.as("item"),
													] as const,
											)
											.whereRef("paymentItemLine.paymentId", "=", "payment.id")
											.where("paymentItemLine.isDeleted", "is not", sqliteTrue)
											.where("paymentItemLine.totalAmount", "is not", null)
											.where("paymentItemLine.quantity", "is not", null)
											.$narrowType<{
												totalAmount: NotNull;
												quantity: NotNull;
												item: NotNull;
											}>(),
									)
									.as("items"),
							] as const,
					)
					.where("payment.isDeleted", "is not", sqliteTrue)
					.where("payment.currency", "is not", null)
					.where("payment.totalAmount", "is not", null)
					.where("payment.direction", "is not", null)
					.where("payment.id", "=", paymentId)
					.limit(1)
					.$narrowType<{
						currency: NotNull;
						totalAmount: NotNull;
						direction: NotNull;
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

			{/*<LoadingIndicator*/}
			{/*	text={*/}
			{/*		paymentFinishedRows === undefined*/}
			{/*			? t("client:historyDetail.status.loading")*/}
			{/*			: paymentFinished*/}
			{/*				? paymentFinished.type === "success"*/}
			{/*					? t("client:historyDetail.status.paid")*/}
			{/*					: (paymentFinished.reason ??*/}
			{/*						t("client:historyDetail.status.failed"))*/}
			{/*				: t("client:historyDetail.status.inProgressOrExpired")*/}
			{/*	}*/}
			{/*	open={true}*/}
			{/*	status={*/}
			{/*		paymentFinishedRows === undefined*/}
			{/*			? "loading"*/}
			{/*			: paymentFinished*/}
			{/*				? paymentFinished.type === "success"*/}
			{/*					? "success"*/}
			{/*					: "failure"*/}
			{/*				: "failure"*/}
			{/*	}*/}
			{/*/>*/}

			{/*<ResponsiveCard>*/}
			{/*	<CardContent>*/}
			{/*		<KeyValueList*/}
			{/*			items={[*/}
			{/*				{*/}
			{/*					key: t("client:historyDetail.fields.name"),*/}
			{/*					value: payment ? (*/}
			{/*						payment.merchantName*/}
			{/*					) : (*/}
			{/*						<Skeleton className={"h-5 w-50"} />*/}
			{/*					),*/}
			{/*				},*/}
			{/*				{*/}
			{/*					key: t("client:historyDetail.fields.phone"),*/}
			{/*					value: payment ? (*/}
			{/*						(payment.merchantPhone ?? "-")*/}
			{/*					) : (*/}
			{/*						<Skeleton className={"h-5 w-50"} />*/}
			{/*					),*/}
			{/*				},*/}
			{/*			]}*/}
			{/*		/>*/}
			{/*	</CardContent>*/}
			{/*</ResponsiveCard>*/}

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

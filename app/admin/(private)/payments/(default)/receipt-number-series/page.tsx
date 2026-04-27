"use client";

import {
	createIdFromString,
	type KyselyNotNull,
	sqliteTrue,
} from "@evolu/common";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { PaymentReceiptLastNumberForm } from "@/app/admin/(private)/payments/(default)/receipt-number-series/payment-receipt-last-number-form";
import { PaymentReceiptNumberSeriesForm } from "@/app/admin/(private)/payments/(default)/receipt-number-series/payment-receipt-number-series-form";
import { ResponsiveCard } from "@/components/responsive-card";
import {
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { createQuery } from "@/lib/evolu";

export default function Page() {
	const { t } = useTranslation();
	const itemId = createIdFromString("");

	const seriesQuery = useMemo(
		() =>
			createQuery((db) =>
				db
					.selectFrom("paymentReceiptNumberSeries")
					.selectAll()
					.where("isDeleted", "is not", sqliteTrue)
					.where("serialNumberDigits", "is not", null)
					.where("yearFormat", "is not", null)
					.where("monthFormat", "is not", null)
					.where("dayFormat", "is not", null)
					.where("id", "=", itemId)
					.$narrowType<{
						serialNumberDigits: KyselyNotNull;
						yearFormat: KyselyNotNull;
						monthFormat: KyselyNotNull;
						dayFormat: KyselyNotNull;
					}>(),
			),
		[itemId],
	);

	const lastNumberQuery = useMemo(
		() =>
			createQuery((db) =>
				db
					.selectFrom("paymentReceiptLastNumber")
					.select(["id", "serialNumber", "date"])
					.where("isDeleted", "is not", sqliteTrue)
					.where("serialNumber", "is not", null)
					.where("id", "=", itemId)
					.$narrowType<{
						serialNumber: KyselyNotNull;
					}>(),
			),
		[itemId],
	);

	const { data: seriesData } = useEvoluQuery(seriesQuery);
	const { data: lastNumberData } = useEvoluQuery(lastNumberQuery);

	const item = seriesData[0];
	const lastNumber = lastNumberData[0];

	return (
		<div className={"flex flex-col gap-4"}>
			<ResponsiveCard className="w-full max-w-xl">
				<CardHeader>
					<CardTitle>{t("settings:page.receiptNumberSeries")}</CardTitle>
				</CardHeader>
				<CardContent>
					<PaymentReceiptNumberSeriesForm
						defaultValues={
							item
								? {
										...item,
										serialNumberDigits: item.serialNumberDigits.toString(),
										prefix: item.prefix ?? "",
									}
								: undefined
						}
					/>
				</CardContent>
			</ResponsiveCard>

			<ResponsiveCard className="w-full max-w-xl">
				<CardHeader>
					<CardTitle>{t("settings:page.lastReceiptNumber")}</CardTitle>
					<CardDescription>
						{t("settings:page.lastReceiptNumberDescription")}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<PaymentReceiptLastNumberForm
						defaultValues={
							lastNumber
								? {
										...lastNumber,
										serialNumber: lastNumber.serialNumber.toString(),
										date: lastNumber.date ? new Date(lastNumber.date) : null,
									}
								: undefined
						}
					/>
				</CardContent>
			</ResponsiveCard>
		</div>
	);
}

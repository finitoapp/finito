"use client";

import {
	createIdFromString,
	type KyselyNotNull,
	sqliteTrue,
} from "@evolu/common";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { InvoiceLastNumberForm } from "@/app/admin/(private)/settings/invoice-number-series/invoice-last-number-form";
import { InvoiceNumberSeriesForm } from "@/app/admin/(private)/settings/invoice-number-series/invoice-number-series-form";
import { ResponsiveCard } from "@/components/responsive-card";
import {
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { createQuery } from "@/lib/evolu";

export default function Home() {
	const { t } = useTranslation();
	const itemId = createIdFromString("");
	const seriesQuery = useMemo(
		() =>
			createQuery((db) => {
				return db
					.selectFrom("invoiceNumberSeries")
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
					}>();
			}),
		[itemId],
	);

	const lastNumberQuery = useMemo(
		() =>
			createQuery((db) => {
				return db
					.selectFrom("invoiceLastNumber")
					.select(["id", "serialNumber", "date"])
					.where("isDeleted", "is not", sqliteTrue)
					.where("serialNumber", "is not", null)
					.where("id", "=", itemId)
					.$narrowType<{
						serialNumber: KyselyNotNull;
					}>();
			}),
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
					<CardTitle>{t("settings:page.invoiceNumberSeries")}</CardTitle>
				</CardHeader>
				<CardContent>
					<InvoiceNumberSeriesForm
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
					<CardTitle>{t("settings:page.lastInvoiceNumber")}</CardTitle>
					<CardDescription>
						The values are used when calculating the subsequent invoice number
					</CardDescription>
				</CardHeader>
				<CardContent>
					<InvoiceLastNumberForm
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
